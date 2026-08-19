-- ---------------------------------------------------------------------------
-- 0061 — Cross-district read access for a non-super-admin analytics viewer
-- ---------------------------------------------------------------------------
--
-- Problem this solves
-- -------------------
-- A user needs to see analytics for four districts. They are not a super
-- admin — they must not administer anything, must not reach the other
-- districts in the platform, and must not read individual student writing.
--
-- Nothing in the schema can express that today. Scope is a scalar:
-- `user_profiles.district_id UUID NOT NULL` (0001), and every district-level
-- policy funnels through `auth_user_is_admin_for_district()` (0002), which
-- reads that one column. One user, one district, by construction.
--
-- Why a grant table rather than widening district_id
-- ---------------------------------------------------
-- Turning `district_id` into an array or a membership table is the obvious
-- move and the wrong one. That column has 158 references across 40 files, and
-- 93 `district_admin` role checks across 58 more depend on the scalar
-- reading; the login subdomain check (lib/actions/auth.ts) compares against
-- it directly. All of that is correct code today, and a widening rewrites
-- every line of it to gain nothing for the 99.9% of users who will always
-- have exactly one district.
--
-- An additive grant table leaves `district_id` meaning what it has always
-- meant — the user's home district, which also keeps the NOT NULL satisfied
-- with no backfill — and layers a second, read-only scope beside it. Nothing
-- that exists changes behaviour.
--
-- Why a new role rather than reusing district_admin
-- --------------------------------------------------
-- `district_analyst` is a new enum value precisely so that all 93 existing
-- `district_admin` checks keep excluding it. The new role starts with access
-- to nothing and is opted in one surface at a time. Reusing district_admin
-- would invert that: the user would silently inherit every district-admin
-- write path in their home district, and the work would become an audit of
-- what to take away — the direction that ships privilege escalation.
--
-- Why aggregates rather than row access
-- --------------------------------------
-- get_district_analytics() is SECURITY DEFINER and returns counts only. That
-- is what keeps this migration from touching any of the ~20 policies that
-- call auth_user_is_admin_for_district(): the viewer never receives SELECT on
-- student_writings at all, so there is no policy to widen and no chance of
-- widening one further than intended. It also means a cross-district observer
-- cannot read one district's students' work while nominally reviewing
-- another's.
--
-- NEEDS LIVE SUPABASE APPLY.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The role.
--
-- Deliberately NOT inside the BEGIN below. Enum additions have historically
-- been transaction-restricted, and more importantly a new value cannot be
-- USED until the statement adding it commits — and part 2 does use it. Bare
-- and idempotent is the portable form; same reasoning as 0023 and 0039, which
-- both added enum values this way.
-- ---------------------------------------------------------------------------

ALTER TYPE jswp_role ADD VALUE IF NOT EXISTS 'district_analyst';


BEGIN;

-- ---------------------------------------------------------------------------
-- 2. Let the new role exist without a school.
--
-- 0001 line 131 carries an unnamed CHECK:
--
--     CHECK (role IN ('super_admin','district_admin') OR school_id IS NOT NULL)
--
-- An analyst has no school, so without this every insert of one fails. Worth
-- noting how that failure would have presented: not as a migration error, but
-- as a runtime insert failure the first time someone provisioned the user.
--
-- The constraint is unnamed, so it is discovered by definition rather than
-- dropped by name — the pattern 0038 established for exactly this situation.
-- It is replaced by a NAMED constraint so the next migration that needs to
-- touch it can skip the discovery dance.
--
-- The replacement compares role::text rather than the enum literal. Casting
-- sidesteps the "unsafe use of new value of enum type" error should this file
-- ever be applied as a single transaction (a SQL-editor paste, say) rather
-- than statement by statement. A CHECK is not index-backed, so the cast costs
-- nothing.
-- ---------------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'user_profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%school_id IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_school_required
  CHECK (
    role::text IN ('super_admin', 'district_admin', 'district_analyst')
    OR school_id IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 3. The grants.
--
-- Composite PK rather than a surrogate id: the pair IS the fact, and it gives
-- idempotent provisioning (ON CONFLICT DO NOTHING) plus the uniqueness that
-- stops a double-click creating two grants for free.
--
-- No `revoked_at` column. A revoked grant is a deleted row, and the history of
-- who granted and revoked what lives in audit_log (0005) where every other
-- privileged action already goes. A soft-delete flag here would be a second
-- copy of that history, free to drift from it — cf. CLAUDE.md §14.3.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS district_access_grants (
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id)     ON DELETE CASCADE,

  -- RESTRICT, not CASCADE: deleting the granting admin must not silently
  -- widen or narrow anyone's access as a side effect.
  granted_by  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, district_id)
);

COMMENT ON TABLE district_access_grants IS
  'Additive, read-only district scope layered beside user_profiles.district_id '
  '(which stays the home district). Consulted only by '
  'auth_user_can_view_district(); grants no write path anywhere. Written by '
  'the service role via an admin action, never from a user session. '
  'Migration 0061.';

COMMENT ON COLUMN district_access_grants.granted_by IS
  'The super admin who issued the grant. Duplicated into audit_log at grant '
  'time; kept here so the live grant set is self-describing without a join '
  'against an append-only log.';

-- The PK's btree covers the hot read (all districts for one user, which is
-- both the switcher and the helper below). This index covers the inverse —
-- everyone who can see district X — which is the revocation-review question a
-- super admin asks when offboarding.
CREATE INDEX IF NOT EXISTS idx_district_access_grants_district
  ON district_access_grants(district_id);

-- ---------------------------------------------------------------------------
-- 4. The helper.
--
-- Same shape and the same SECURITY DEFINER / search_path discipline as the
-- auth_user_* family in 0001 and 0002. It WRAPS auth_user_is_admin_for_district
-- rather than restating its logic, so super-admin-sees-everything and
-- district-admin-sees-their-own keep exactly one definition (CLAUDE.md §14.4).
--
-- Note the asymmetry this creates on purpose: `can_view` is a strict superset
-- of `is_admin_for`, and only read paths ever call it. No write policy should
-- ever reference this function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auth_user_can_view_district(d_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    auth_user_is_admin_for_district(d_id)
    OR EXISTS (
      SELECT 1
      FROM district_access_grants g
      JOIN user_profiles u ON u.id = g.user_id
      WHERE g.user_id = auth.uid()
        AND g.district_id = d_id
        AND u.active = TRUE
    );
$$;

COMMENT ON FUNCTION auth_user_can_view_district(UUID) IS
  'READ-ONLY scope check: TRUE if the caller administers the district or holds '
  'a district_access_grants row for it. Strict superset of '
  'auth_user_is_admin_for_district(). Never reference this from an INSERT/'
  'UPDATE/DELETE policy or a WITH CHECK clause. Migration 0061.';

-- ---------------------------------------------------------------------------
-- 5. RLS on the grants themselves.
--
-- Read-your-own plus read-in-scope; no INSERT/UPDATE/DELETE policy at all, so
-- the service role is the only writer. Same posture as audit_log (0005) and
-- writing_submissions (0060).
--
-- The self-read is what the district switcher queries. It is safe because a
-- row tells the user only which districts they were already granted — no
-- membership of anyone else's is visible through it.
-- ---------------------------------------------------------------------------

ALTER TABLE district_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS district_access_grants_read_self ON district_access_grants;
CREATE POLICY district_access_grants_read_self ON district_access_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Deliberately auth_user_is_admin_for_district and NOT the new can_view
-- helper: a grant is an administrative fact about a district, so seeing who
-- holds one is an admin capability. Using can_view here would let one analyst
-- enumerate the others.
DROP POLICY IF EXISTS district_access_grants_read_admin ON district_access_grants;
CREATE POLICY district_access_grants_read_admin ON district_access_grants
  FOR SELECT TO authenticated
  USING (auth_user_is_admin_for_district(district_id));

-- ---------------------------------------------------------------------------
-- 6. The analytics read path.
--
-- Both functions below are SECURITY DEFINER, so RLS does not apply inside
-- them and the in-body gate is the ONLY thing standing between a caller and
-- four districts' worth of data. Treat any edit to either as a security
-- change.
--
-- Aggregates only. Nothing here returns a student name, a writing id, or a
-- sentence of student text, and nothing here should be extended to — that
-- constraint is what lets the whole feature ship without widening a single
-- existing policy.
--
-- Counts, not rates. Every metric is returned as a numerator and its
-- denominator rather than a percentage. Three reasons: division by zero stays
-- a UI concern rather than a NULLIF sprinkled through the SQL; the UI can show
-- "3 of 7" beside "43%" so a rate over a tiny denominator is visibly
-- discountable; and rounding stays in one place.
--
-- Windowing convention, applied consistently below:
--   * COHORT metrics filter on created_at — "of the writings started in this
--     window, how many finished". A writing started before the window is not
--     in the cohort even if it finished inside it, so numerator and
--     denominator always describe the same population.
--   * ACTIVITY metrics filter on the timestamp of the act itself
--     (released_at, last_student_edit_at, graded_at) — "did this teacher do
--     anything in this window".
-- Mixing the two silently produces rates above 100%, which is how you notice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_district_analytics(
  p_district_id UUID,
  p_since       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days',
  p_until       TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  district_id           UUID,
  district_name         TEXT,
  window_since          TIMESTAMPTZ,
  window_until          TIMESTAMPTZ,

  -- Roster denominators.
  schools               BIGINT,
  teachers              BIGINT,
  students              BIGINT,

  -- 1-2. Adoption: did the district actually turn it on?
  teachers_active       BIGINT,
  students_active       BIGINT,

  -- 3. Completion, as a cohort of writings started in the window.
  writings_started      BIGINT,
  writings_completed    BIGINT,

  -- 5. Fidelity: mode mix across assignments published in the window.
  assignments_total     BIGINT,
  assignments_expository    BIGINT,
  assignments_argumentation BIGINT,
  assignments_literary      BIGINT,
  assignments_narrative     BIGINT,

  -- 7. Feedback turnaround, over writings graded in the window.
  writings_graded       BIGINT,
  median_days_to_feedback NUMERIC,

  -- 8. Revision: writings that came back for a second pass.
  writings_submitted    BIGINT,
  writings_revised      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  -- The gate. RLS does not apply inside this function; this is the whole
  -- authorization story. RAISE rather than RETURN NULL so a caller that
  -- forgets to check fails loudly instead of rendering a convincing
  -- all-zeroes dashboard.
  IF NOT auth_user_can_view_district(p_district_id) THEN
    RAISE EXCEPTION 'not authorized to view district %', p_district_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH
  -- Every writing belonging to a student in this district, with the fields
  -- the metrics below need. Materialised once rather than re-joined per
  -- metric.
  district_writings AS (
    SELECT
      w.id,
      w.status,
      w.created_at,
      w.submitted_at,
      w.graded_at,
      w.last_student_edit_at,
      w.student_id
    FROM student_writings w
    JOIN user_profiles u ON u.id = w.student_id
    WHERE u.district_id = p_district_id
  ),
  -- Writings with more than one recorded submission. 0060 makes this
  -- knowable at all: student_writings.submitted_at is last-write-wins, so
  -- before that migration a resubmit erased the evidence of the first.
  revised AS (
    SELECT ws.student_writing_id
    FROM writing_submissions ws
    JOIN district_writings dw ON dw.id = ws.student_writing_id
    GROUP BY ws.student_writing_id
    HAVING COUNT(*) > 1
  )
  SELECT
    d.id,
    d.name::TEXT,
    p_since,
    p_until,

    (SELECT COUNT(*) FROM schools s WHERE s.district_id = d.id),
    (SELECT COUNT(*) FROM user_profiles u
      WHERE u.district_id = d.id AND u.role = 'teacher' AND u.active),
    (SELECT COUNT(*) FROM user_profiles u
      WHERE u.district_id = d.id AND u.role = 'student' AND u.active),

    -- A teacher counts as active by RELEASING an assignment, not by creating
    -- one. A draft that never reaches a student is not adoption.
    (SELECT COUNT(DISTINCT a.teacher_id) FROM assignments a
      WHERE a.district_id = d.id
        AND a.released_at IS NOT NULL
        AND a.released_at BETWEEN p_since AND p_until),

    -- last_student_edit_at (0054) is written only on behalf of the owning
    -- student, so unlike updated_at it cannot be moved by a teacher grading
    -- the piece. That distinction is the whole point of the column.
    (SELECT COUNT(DISTINCT dw.student_id) FROM district_writings dw
      WHERE dw.last_student_edit_at BETWEEN p_since AND p_until),

    (SELECT COUNT(*) FROM district_writings dw
      WHERE dw.created_at BETWEEN p_since AND p_until),
    (SELECT COUNT(*) FROM district_writings dw
      WHERE dw.created_at BETWEEN p_since AND p_until
        AND dw.status IN ('submitted', 'returned', 'graded')),

    (SELECT COUNT(*) FROM assignments a
      WHERE a.district_id = d.id
        AND a.released_at BETWEEN p_since AND p_until),
    (SELECT COUNT(*) FROM assignments a
      WHERE a.district_id = d.id AND a.mode = 'expository'
        AND a.released_at BETWEEN p_since AND p_until),
    (SELECT COUNT(*) FROM assignments a
      WHERE a.district_id = d.id AND a.mode = 'argumentation'
        AND a.released_at BETWEEN p_since AND p_until),
    (SELECT COUNT(*) FROM assignments a
      WHERE a.district_id = d.id AND a.mode = 'literary'
        AND a.released_at BETWEEN p_since AND p_until),
    (SELECT COUNT(*) FROM assignments a
      WHERE a.district_id = d.id AND a.mode = 'narrative'
        AND a.released_at BETWEEN p_since AND p_until),

    (SELECT COUNT(*) FROM district_writings dw
      WHERE dw.graded_at BETWEEN p_since AND p_until),
    -- Median rather than mean: one writing graded six months late would drag
    -- an average into uselessness, and turnaround distributions are exactly
    -- the shape that happens in.
    (SELECT ROUND(
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (dw.graded_at - dw.submitted_at))
              )::NUMERIC / 86400.0, 1)
       FROM district_writings dw
      WHERE dw.graded_at BETWEEN p_since AND p_until
        AND dw.submitted_at IS NOT NULL
        AND dw.graded_at >= dw.submitted_at),

    (SELECT COUNT(*) FROM district_writings dw
      WHERE dw.created_at BETWEEN p_since AND p_until
        AND dw.status IN ('submitted', 'returned', 'graded')),
    (SELECT COUNT(*) FROM district_writings dw
       JOIN revised r ON r.student_writing_id = dw.id
      WHERE dw.created_at BETWEEN p_since AND p_until)

  FROM districts d
  WHERE d.id = p_district_id;
END;
$$;

COMMENT ON FUNCTION get_district_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Aggregate-only district analytics, gated on auth_user_can_view_district(). '
  'SECURITY DEFINER — the in-body gate is the sole authorization check, so any '
  'edit is a security change. Returns numerators and denominators, never '
  'rates; the UI divides. Must never return student-identifying rows or '
  'writing content. Migration 0061.';

-- ---------------------------------------------------------------------------
-- 7. The step funnel.
--
-- Separate from the function above because it returns MANY rows per district
-- (one per mode/step) rather than one, and because of a hard architectural
-- constraint: the database does not know the step list or its order.
-- `step_progress.step_key` is an opaque string and CLAUDE.md §7 is explicit
-- that `lib/jswp-modes.ts` is the only place ordering lives — "Never hard-code
-- a step list anywhere else."
--
-- So this function deliberately does NOT compute the stall step or the skip
-- rate. It returns the raw per-step counts, unordered, and
-- lib/queries/district-analytics.ts orders them through getSteps() and derives
-- both. Encoding the order here would create a second step list to drift from
-- the config — precisely the coupling §14.2 catalogues.
--
-- What the caller can derive from these counts:
--   * stall step — the largest drop between consecutive ordered steps
--   * skip rate  — writings holding a row at a LATER step but none here, i.e.
--                  they advanced past without doing the work. Reachable
--                  because skip-step-button.tsx advances current_step without
--                  writing step_progress; that absence is the signal.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_district_step_funnel(
  p_district_id UUID,
  p_since       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days',
  p_until       TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  mode                jswp_mode,
  step_key            TEXT,
  writings_reached    BIGINT,
  mode_writings_total BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF NOT auth_user_can_view_district(p_district_id) THEN
    RAISE EXCEPTION 'not authorized to view district %', p_district_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohort AS (
    SELECT w.id, a.mode
    FROM student_writings w
    JOIN user_profiles u ON u.id = w.student_id
    JOIN assignments   a ON a.id = w.assignment_id
    WHERE u.district_id = p_district_id
      AND w.created_at BETWEEN p_since AND p_until
  ),
  mode_totals AS (
    SELECT c.mode AS m, COUNT(*) AS total
    FROM cohort c
    GROUP BY c.mode
  )
  SELECT
    c.mode,
    sp.step_key::TEXT,
    COUNT(DISTINCT sp.student_writing_id),
    mt.total
  FROM step_progress sp
  JOIN cohort c      ON c.id = sp.student_writing_id
  JOIN mode_totals mt ON mt.m = c.mode
  -- A row with no completed_at is a step opened but not finished. The funnel
  -- counts completion, so those are excluded rather than counted as reached.
  WHERE sp.completed_at IS NOT NULL
  GROUP BY c.mode, sp.step_key, mt.total;
END;
$$;

COMMENT ON FUNCTION get_district_step_funnel(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Per-step completion counts for a district cohort, gated on '
  'auth_user_can_view_district(). Returns counts UNORDERED by design — step '
  'ordering lives only in lib/jswp-modes.ts (CLAUDE.md §7), so stall step and '
  'skip rate are derived in TypeScript, not here. Migration 0061.';

-- anon has no business calling functions whose only guard is auth.uid().
REVOKE EXECUTE ON FUNCTION
  get_district_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION
  get_district_step_funnel(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION auth_user_can_view_district(UUID) FROM anon;

COMMIT;
