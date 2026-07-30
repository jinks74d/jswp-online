-- ============================================================================
-- 0014 — Fix RLS recursion between exemplars and assignment_exemplars
-- ============================================================================
-- 0013 introduced exemplars_student_read_via_pin which does
-- EXISTS on assignment_exemplars. assignment_exemplars_teacher_all
-- WITH CHECK does EXISTS on exemplars. Postgres detects the table-level
-- cycle and aborts INSERTs into assignment_exemplars with:
--   infinite recursion detected in policy for relation "assignment_exemplars"
--
-- Fix: replace the inline EXISTS in the via-pin policy with a SECURITY
-- DEFINER helper function. The helper bypasses RLS on the tables it
-- reads (assignment_exemplars + assignments + class_student_enrollments),
-- so the static cycle disappears. Same pattern as 6.1's
-- auth_user_student_can_read_exemplar.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION auth_user_student_can_read_pinned_exemplar(target_exemplar_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignment_exemplars ae
    JOIN assignments a ON a.id = ae.assignment_id
    WHERE ae.exemplar_id = target_exemplar_id
      AND a.class_period_id IS NOT NULL
      AND a.released_at IS NOT NULL
      AND a.released_at <= NOW()
      AND EXISTS (
        SELECT 1 FROM class_student_enrollments cse
        WHERE cse.class_period_id = a.class_period_id
          AND cse.student_id = auth.uid()
          AND cse.unenrolled_at IS NULL
      )
  );
$$;

DROP POLICY IF EXISTS exemplars_student_read_via_pin ON exemplars;

CREATE POLICY exemplars_student_read_via_pin ON exemplars
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND auth_user_role() = 'student'
    AND auth_user_student_can_read_pinned_exemplar(id)
  );

COMMIT;
