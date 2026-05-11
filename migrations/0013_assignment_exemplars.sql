-- ============================================================================
-- 0013 — Assignment ↔ Exemplar pins (chunk 6.2)
-- ============================================================================
-- Many-to-many between assignments and exemplars. A pin says "this exemplar
-- is referenced from this assignment"; students viewing a writing on a
-- pinned assignment see those exemplars first; if no pins, the 6.1
-- mode-default fallback runs.
--
-- Composite PK (assignment_id, exemplar_id) enforces uniqueness — an
-- exemplar can't be pinned twice to the same assignment, but the same
-- exemplar can be pinned to many different assignments.
--
-- position is reserved for future reorder UI. v1 sorts by
-- (position ASC, pinned_at ASC) so unset positions still preserve
-- insertion order.
-- ============================================================================

BEGIN;

CREATE TABLE assignment_exemplars (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  exemplar_id   UUID NOT NULL REFERENCES exemplars(id)   ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  pinned_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  pinned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assignment_id, exemplar_id)
);

CREATE INDEX idx_assignment_exemplars_exemplar
  ON assignment_exemplars(exemplar_id);

ALTER TABLE assignment_exemplars ENABLE ROW LEVEL SECURITY;

-- Teacher full CRUD: must own the assignment, and (for writes) must also
-- own the exemplar being pinned. Defense in depth — the picker UI also
-- filters to owned exemplars.
CREATE POLICY assignment_exemplars_teacher_all ON assignment_exemplars
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_exemplars.assignment_id
        AND a.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_exemplars.assignment_id
        AND a.teacher_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM exemplars e
      WHERE e.id = assignment_exemplars.exemplar_id
        AND e.created_by = auth.uid()
    )
  );

-- Student SELECT: walks the existing assignments_student_read gate
-- (enrolled in the period, assignment released, released_at <= NOW()).
CREATE POLICY assignment_exemplars_student_read ON assignment_exemplars
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_exemplars.assignment_id
        AND a.class_period_id IS NOT NULL
        AND auth_user_enrolled_in_class_period(a.class_period_id)
        AND a.released_at IS NOT NULL
        AND a.released_at <= NOW()
    )
  );

-- Admin read in scope (school admin / district admin / super admin via the
-- shared helper).
CREATE POLICY assignment_exemplars_admin_read ON assignment_exemplars
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_exemplars.assignment_id
        AND auth_user_is_admin_for_school(a.school_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Additional exemplar visibility for students: via-pin
-- ---------------------------------------------------------------------------
-- The 6.1 exemplars_student_read policy requires the student's *current*
-- teacher to be the exemplar's creator. If a teacher gets reassigned mid-
-- cohort but their old assignment + pinned exemplar are still alive, the
-- student would see the pin row but not the exemplar content. Add a
-- via-pin path: a published exemplar is readable if it's pinned to an
-- assignment the student can read.
--
-- Implementation note: the natural inline EXISTS would create a
-- table-level cycle between exemplars and assignment_exemplars
-- (assignment_exemplars_teacher_all WITH CHECK does EXISTS on exemplars;
-- this policy would do EXISTS on assignment_exemplars). Postgres flags
-- the cycle even though runtime AND short-circuits would prevent
-- infinite recursion. Hide the dependency behind a SECURITY DEFINER
-- helper, same pattern as 6.1's auth_user_student_can_read_exemplar.
--
-- Postgres ORs multiple SELECT policies, so this stacks alongside the
-- existing exemplars_student_read without breaking it.

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

CREATE POLICY exemplars_student_read_via_pin ON exemplars
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND auth_user_role() = 'student'
    AND auth_user_student_can_read_pinned_exemplar(id)
  );

COMMIT;
