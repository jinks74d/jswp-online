-- ============================================================================
-- JSWP Online — Defense-in-depth on assignments_teacher_own (0009)
-- ============================================================================
-- The original policy in 0002 gates teacher access on teacher_id = auth.uid()
-- only. The application always sets assignments.district_id and school_id
-- from the teacher's profile at creation time (see lib/actions/assignments.ts),
-- so a row whose teacher_id matches but whose tenancy columns disagree with
-- the caller's profile would only arise from (a) a service-role bypass write
-- or (b) the teacher's profile being moved to a different tenancy after the
-- assignment was created. Both are scenarios we want to deny: the row no
-- longer belongs to the caller's current district/school.
--
-- This migration tightens the policy to also require:
--   district_id = auth_user_district_id()
--   school_id   = auth_user_school_id()
--
-- Co-teacher, admin, and student policies are unchanged.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS assignments_teacher_own ON assignments;

CREATE POLICY assignments_teacher_own ON assignments
  FOR ALL TO authenticated
  USING (
    teacher_id = auth.uid()
    AND district_id = auth_user_district_id()
    AND school_id = auth_user_school_id()
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND district_id = auth_user_district_id()
    AND school_id = auth_user_school_id()
  );

COMMIT;
