-- ============================================================================
-- 0015 — School-shared exemplars (chunk 6.3)
-- ============================================================================
-- Adds shared_with_school flag on exemplars so a teacher can mark an
-- exemplar visible to other teachers at the same school. Sharing is
-- separate from publishing:
--   shared_with_school = TRUE  → other teachers can view + pin
--   is_published       = TRUE  → students can view (own students by
--                                 default; other teachers' students
--                                 only when pinned via 6.2's via-pin)
--
-- Per the 6.3 audit, the (shared=TRUE, published=FALSE) combination is
-- "peer preview" — colleagues can review draft exemplars before they
-- go to students. Student-side gates still require is_published, so
-- nothing leaks to students from peer-preview state.
--
-- Two policy changes:
--   1. New exemplars_school_teacher_read for cross-teacher visibility.
--      No is_published clause (α from the audit).
--   2. Relaxed assignment_exemplars_teacher_all WITH CHECK to allow
--      pinning shared exemplars at the same school. The pin still
--      requires the caller to own the assignment.
-- ============================================================================

BEGIN;

ALTER TABLE exemplars
  ADD COLUMN shared_with_school BOOLEAN NOT NULL DEFAULT FALSE;

-- Complements idx_exemplars_school_mode_published (which serves the
-- student-side own-teacher read). This index serves the cross-teacher
-- read path: same school + matching mode + shared.
CREATE INDEX idx_exemplars_school_shared_published
  ON exemplars(school_id, mode)
  WHERE shared_with_school = TRUE;

-- ---------------------------------------------------------------------------
-- New: cross-teacher read
-- ---------------------------------------------------------------------------
-- Other teachers at the same school can read shared exemplars regardless
-- of publish state. Students still gated by is_published in their own
-- policies, so peer preview never leaks to students.
--
-- created_by != auth.uid() excludes the owner's own rows from this
-- policy path (they have full CRUD via exemplars_owner_all). Skipping
-- redundant evaluation keeps the query plan cleaner.
CREATE POLICY exemplars_school_teacher_read ON exemplars
  FOR SELECT TO authenticated
  USING (
    shared_with_school = TRUE
    AND school_id = auth_user_school_id()
    AND auth_user_role() IN (
      'teacher', 'school_admin', 'district_admin', 'super_admin'
    )
    AND created_by != auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Updated: pin policy allows pinning shared exemplars
-- ---------------------------------------------------------------------------
-- Drop and recreate. USING is unchanged (still gated on owning the
-- assignment). WITH CHECK widens to: own the exemplar OR same-school
-- shared exemplar. The is_published clause is intentionally absent
-- per the audit's α — pin can include shared drafts; student-side
-- via-pin still requires is_published.
DROP POLICY IF EXISTS assignment_exemplars_teacher_all ON assignment_exemplars;

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
        AND (
          e.created_by = auth.uid()
          OR (
            e.shared_with_school = TRUE
            AND e.school_id = auth_user_school_id()
          )
        )
    )
  );

COMMIT;
