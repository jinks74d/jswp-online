-- ============================================================================
-- 0051 — Scope the assignment↔period write policy to periods you actually teach
-- ============================================================================
-- 0050 shipped `assignment_class_periods_write` as:
--
--   FOR ALL USING/WITH CHECK (auth_user_can_write_assignment(assignment_id))
--
-- which constrains the ASSIGNMENT side of the pairing and says nothing at all
-- about the PERIOD side. Owning an assignment satisfies
-- auth_user_can_write_assignment, so as written that policy lets any teacher
-- pair their own assignment with ANY class_period_id — including a period in
-- another school or district — by posting straight to PostgREST with their
-- session JWT. The students in that period would then satisfy
-- auth_user_enrolled_in_assignment and gain read access to the assignment plus
-- the ability to open writings on it. `FOR ALL` extends the same gap to UPDATE
-- and DELETE.
--
-- IMPORTANT — what was actually observed (2026-08-05). The LIVE database does
-- NOT behave this way: probing it as the demo teacher, an insert naming a
-- period they do not teach is refused with 42501 even though
-- auth_user_can_write_assignment returns true for that assignment, and a
-- period they DO teach is accepted. So live already carries a period-side
-- check that the committed 0050 text does not describe. This migration is
-- therefore NOT an emergency patch on live — it is a correction to the
-- VERSION-CONTROLLED schema, which is what a fresh Supabase project, a
-- disaster-recovery rebuild, or a new district's database would be built from.
-- Applied to the current live DB it should be a behavioural no-op.
--
-- The drift was invisible to `npm run db:check` because __schema_inventory()
-- (0028) aggregates pg_policies.policyname only — it compares policy NAMES,
-- never `qual` / `with_check`. A policy can be arbitrarily wrong and still
-- report present. Tracked in BACKLOG.
--
-- lib/actions/assignments.ts also refuses forged period ids in
-- `assertTeachesPeriods`, and its comment names this exact gap. But that is an
-- application-layer check on a database the browser can reach directly with
-- the anon key, which is the arrangement CLAUDE.md §14.5 exists to prevent.
-- RLS has to carry it, in the migration text as well as on the server.
--
-- The rule this installs: you may pair an assignment with a period only when
-- the period is in the SAME SCHOOL as the assignment and you either teach that
-- period or administer that school. Same-school is checked independently of
-- who you are, so it holds even for a district or super admin — an assignment
-- belongs to one school, and pairing it across schools is never meaningful.
--
-- Following §14.4, the period-side test goes in one SECURITY DEFINER helper
-- rather than being inlined into USING and WITH CHECK separately. SECURITY
-- DEFINER also keeps class_periods and assignments out of this policy's
-- dependency graph, the same precaution 0050 §3 and 0014 took.
--
-- Note on the narrowed USING: `writeAssignmentPeriods` clears an assignment's
-- periods with a blanket DELETE before re-inserting. Under this policy that
-- DELETE now skips rows for periods the caller does not teach, so a co-teacher
-- editing a shared assignment can no longer drop another teacher's class off
-- it. That is the safer failure and it matches what `assertTeachesPeriods`
-- already enforces on the way in.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The period-side test.
--    Deliberately takes BOTH ids: the same-school invariant is a relationship
--    between the assignment and the period, not a property of either alone.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_can_assign_to_period(a_id UUID, cp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_periods cp
    JOIN assignments  a ON a.id = a_id
    WHERE cp.id = cp_id
      AND cp.school_id = a.school_id
      AND (
        auth_user_teaches_class_period(cp.id)
        OR auth_user_is_admin_for_school(cp.school_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-issue the write policy with the period side constrained.
--    The read policy from 0050 is unchanged and is NOT re-issued here: it
--    already scopes students to their own enrolled period and everyone else to
--    assignments they can write.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assignment_class_periods_write ON assignment_class_periods;

CREATE POLICY assignment_class_periods_write ON assignment_class_periods
  FOR ALL TO authenticated
  USING (
    auth_user_can_write_assignment(assignment_id)
    AND auth_user_can_assign_to_period(assignment_id, class_period_id)
  )
  WITH CHECK (
    auth_user_can_write_assignment(assignment_id)
    AND auth_user_can_assign_to_period(assignment_id, class_period_id)
  );

COMMIT;
