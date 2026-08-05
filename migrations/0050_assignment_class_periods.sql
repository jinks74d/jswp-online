-- ============================================================================
-- 0050 — One assignment, many class periods (with per-period due dates)
-- ============================================================================
-- Teachers teach the same unit to several periods and want to author the
-- assignment once. `assignments.class_period_id` allowed exactly one, forcing
-- them to duplicate the whole assignment — prompt, sources, rubric and all —
-- per class, and then grade from N separate submission lists.
--
-- This introduces `assignment_class_periods`, one row per (assignment,
-- period), carrying that period's OWN due date. Period 1 meets Monday and
-- Period 6 meets Tuesday, so the deadline is a property of the pairing, not
-- of the assignment.
--
-- Transition strategy mirrors 0040 (assignment_sources): keep the legacy
-- `assignments.class_period_id` column in place, backfill one junction row per
-- assignment that has one, and cut every reader over. A later migration drops
-- the legacy column once nothing reads it. `assignments.due_at` survives as
-- the DEFAULT — a junction row with due_at IS NULL inherits it — so existing
-- readers keep working and a teacher who wants one date for all classes sets
-- it in one place.
--
-- RLS is the bulk of this file. Every policy that asked "is the caller on / in
-- THE assignment's period" must now ask "…any of its periods". Rather than
-- spread that join across a dozen policies (CLAUDE.md §14.4), it goes in two
-- SECURITY DEFINER helpers — auth_user_teaches_assignment and
-- auth_user_enrolled_in_assignment — and every policy calls one of them.
-- SECURITY DEFINER also keeps the junction out of the policy dependency graph,
-- avoiding the static-cycle recursion that 0014 had to untangle.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The junction table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignment_class_periods (
  assignment_id   UUID NOT NULL REFERENCES assignments(id)    ON DELETE CASCADE,
  class_period_id UUID NOT NULL REFERENCES class_periods(id)  ON DELETE CASCADE,

  -- This period's deadline. NULL inherits assignments.due_at, which is what
  -- "one date for every class" looks like in storage.
  due_at          TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (assignment_id, class_period_id)
);

-- The PK covers assignment_id lookups; this covers the student direction
-- ("which assignments reach this period"), which every student read performs.
CREATE INDEX IF NOT EXISTS assignment_class_periods_period_idx
  ON assignment_class_periods (class_period_id);

-- ---------------------------------------------------------------------------
-- 2. Backfill — one row per assignment that currently targets a period.
--    Idempotent: ON CONFLICT DO NOTHING means a re-run inserts nothing.
--    due_at is copied explicitly rather than left NULL so that a later edit to
--    assignments.due_at cannot silently move a deadline students already saw.
-- ---------------------------------------------------------------------------
INSERT INTO assignment_class_periods (assignment_id, class_period_id, due_at)
SELECT a.id, a.class_period_id, a.due_at
FROM assignments a
WHERE a.class_period_id IS NOT NULL
ON CONFLICT (assignment_id, class_period_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. The two helpers every rewritten policy funnels through.
--    SECURITY DEFINER + STABLE, matching the auth_user_* family in 0001/0002.
-- ---------------------------------------------------------------------------

-- Is the caller a teacher on ANY period this assignment is assigned to?
CREATE OR REPLACE FUNCTION auth_user_teaches_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignment_class_periods acp
    JOIN class_teacher_assignments cta
      ON cta.class_period_id = acp.class_period_id
    WHERE acp.assignment_id = a_id
      AND cta.teacher_id = auth.uid()
  );
$$;

-- Is the caller a currently-enrolled student in ANY of its periods?
-- Mirrors auth_user_enrolled_in_class_period's unenrolled_at IS NULL rule.
CREATE OR REPLACE FUNCTION auth_user_enrolled_in_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignment_class_periods acp
    JOIN class_student_enrollments cse
      ON cse.class_period_id = acp.class_period_id
    WHERE acp.assignment_id = a_id
      AND cse.student_id = auth.uid()
      AND cse.unenrolled_at IS NULL
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS on the junction itself.
--    Teachers/admins who may edit the assignment see and manage every row.
--    A student sees ONLY the row for the period they are in — the other rows
--    are another class's schedule and are none of their business.
-- ---------------------------------------------------------------------------
ALTER TABLE assignment_class_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_class_periods_read  ON assignment_class_periods;
DROP POLICY IF EXISTS assignment_class_periods_write ON assignment_class_periods;

CREATE POLICY assignment_class_periods_read ON assignment_class_periods
  FOR SELECT TO authenticated
  USING (
    auth_user_can_write_assignment(assignment_id)
    OR (
      auth_user_can_read_assignment(assignment_id)
      AND auth_user_enrolled_in_class_period(class_period_id)
    )
  );

CREATE POLICY assignment_class_periods_write ON assignment_class_periods
  FOR ALL TO authenticated
  USING (auth_user_can_write_assignment(assignment_id))
  WITH CHECK (auth_user_can_write_assignment(assignment_id));

-- ---------------------------------------------------------------------------
-- 5. Rewrite the assignment-scoped helpers from 0040.
--    Same shape as before; the single-period tests become the any-period
--    helpers. The legacy column is no longer consulted — step 2 guaranteed
--    every assignment that had one now has a matching junction row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_can_read_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = a_id
      AND (
        a.teacher_id = auth.uid()
        OR auth_user_teaches_assignment(a.id)
        OR auth_user_is_admin_for_school(a.school_id)
        OR (
          auth_user_enrolled_in_assignment(a.id)
          AND (a.released_at IS NULL OR a.released_at <= NOW())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_can_write_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = a_id
      AND (
        a.teacher_id = auth.uid()
        OR auth_user_teaches_assignment(a.id)
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Rewrite the per-writing helpers from 0002. Only the co-teacher branch
--    changes: it was an inline join on a.class_period_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_can_read_writing(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_writings sw
    JOIN assignments a ON a.id = sw.assignment_id
    WHERE sw.id = w_id
      AND (
        sw.student_id = auth.uid()
        OR a.teacher_id = auth.uid()
        OR auth_user_teaches_assignment(a.id)
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_can_write_writing(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_writings sw
    JOIN assignments a ON a.id = sw.assignment_id
    WHERE sw.id = w_id
      AND (
        (sw.student_id = auth.uid()
         AND sw.status IN ('draft','in_progress','returned'))
        OR a.teacher_id = auth.uid()
        OR auth_user_teaches_assignment(a.id)
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Rewrite the pinned-exemplar helper from 0014. Keeps 0014's reason for
--    existing: an inline EXISTS here re-creates the policy cycle.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_student_can_read_pinned_exemplar(target_exemplar_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignment_exemplars ae
    JOIN assignments a ON a.id = ae.assignment_id
    WHERE ae.exemplar_id = target_exemplar_id
      AND a.released_at IS NOT NULL
      AND a.released_at <= NOW()
      AND auth_user_enrolled_in_assignment(a.id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 8. Policies on `assignments`.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assignments_coteacher_read   ON assignments;
DROP POLICY IF EXISTS assignments_coteacher_update ON assignments;
DROP POLICY IF EXISTS assignments_student_read     ON assignments;

CREATE POLICY assignments_coteacher_read ON assignments
  FOR SELECT TO authenticated
  USING (auth_user_teaches_assignment(id));

CREATE POLICY assignments_coteacher_update ON assignments
  FOR UPDATE TO authenticated
  USING (auth_user_teaches_assignment(id))
  WITH CHECK (auth_user_teaches_assignment(id));

-- Preserves 0008's tightening: a student sees an assignment only once it has
-- actually been released (released_at NOT NULL and in the past), never merely
-- because released_at is unset.
CREATE POLICY assignments_student_read ON assignments
  FOR SELECT TO authenticated
  USING (
    auth_user_enrolled_in_assignment(id)
    AND released_at IS NOT NULL
    AND released_at <= NOW()
  );

-- ---------------------------------------------------------------------------
-- 9. Policies on `student_writings`.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS student_writings_student_insert ON student_writings;
DROP POLICY IF EXISTS student_writings_teacher_select ON student_writings;
DROP POLICY IF EXISTS student_writings_teacher_update ON student_writings;

-- Release/close semantics carried over verbatim from 0002 — only the period
-- test changed.
CREATE POLICY student_writings_student_insert ON student_writings
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_id
        AND auth_user_enrolled_in_assignment(a.id)
        AND (a.released_at IS NULL OR a.released_at <= NOW())
        AND (a.closed_at IS NULL OR a.closed_at > NOW())
    )
  );

CREATE POLICY student_writings_teacher_select ON student_writings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (a.teacher_id = auth.uid() OR auth_user_teaches_assignment(a.id))
    )
  );

CREATE POLICY student_writings_teacher_update ON student_writings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (a.teacher_id = auth.uid() OR auth_user_teaches_assignment(a.id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (a.teacher_id = auth.uid() OR auth_user_teaches_assignment(a.id))
    )
  );

-- ---------------------------------------------------------------------------
-- 10. Policy on `assignment_exemplars` (0013).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assignment_exemplars_student_read ON assignment_exemplars;

CREATE POLICY assignment_exemplars_student_read ON assignment_exemplars
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_exemplars.assignment_id
        AND auth_user_enrolled_in_assignment(a.id)
        AND a.released_at IS NOT NULL
        AND a.released_at <= NOW()
    )
  );

-- ---------------------------------------------------------------------------
-- 11. updated_at trigger. 0001 attached these by looping over every table with
--     an updated_at column, so a table added later needs its own — same
--     trigger name and same shared function, so the convention still holds.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON assignment_class_periods;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON assignment_class_periods
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMIT;
