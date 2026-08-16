-- ---------------------------------------------------------------------------
-- 0058_scope_teacher_pairings_and_second_parent_checks.sql
--
-- Two RLS findings from the 2026-08-16 coverage sweep, approved by Raymond
-- the same day (CLAUDE.md §15.4 sign-off for policy changes).
--
-- 1. class_teacher_assignments_read let ANY admin read EVERY district's
--    teacher-to-class-period pairings. The admin branch carried no scope
--    predicate at all.
--
-- 2. shaping_chunk_outputs and commentary_items each carry a second foreign
--    key their write policy never checked, so a student could hang a row off
--    their own gated parent while pointing the ungated column at another
--    student's row.
--
-- Both were pinned as DOCUMENTS tests in __tests__/schema/rls.test.ts; this
-- migration flips them to negative assertions in the same commit.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Scope the admin branch of class_teacher_assignments_read.
--
-- Was:  teacher_id = auth.uid()
--       OR auth_user_role() IN ('super_admin','district_admin','school_admin')
--
-- Probed 2026-08-16 with a district_admin in the cross-tenant fixture
-- district: they read the demo district's pairings. Severity was metadata
-- disclosure rather than escalation — the scope is which teacher teaches
-- which period, and it did not widen access to student work, because
-- auth_user_can_read_writing's teacher branch runs through
-- auth_user_teaches_class_period, which tests teacher_id = auth.uid() and is
-- unaffected by who may SELECT this table.
--
-- The shape below is lifted from class_student_enrollments_admin_manage and
-- from this table's OWN admin_manage policy, both of which already gate on
-- auth_user_is_admin_for_school. The read policy was simply the odd one out.
--
-- auth_user_is_admin_for_school returns TRUE for super_admin against any
-- school, so cross-district super-admin reads are unchanged.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS class_teacher_assignments_read ON class_teacher_assignments;

CREATE POLICY class_teacher_assignments_read ON class_teacher_assignments
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_periods cp
      WHERE cp.id = class_teacher_assignments.class_period_id
        AND auth_user_is_admin_for_school(cp.school_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Check the second parent on the two artifact tables that have one.
--
-- Every other student-work artifact has a single parent, which is why this
-- shape survived the earlier sweeps: there was nothing to compare it against.
--
--   shaping_chunk_outputs  gated on shaping_sheet_id, chunk_id     ungated
--   commentary_items       gated on chunk_id,         parent_cd_id ungated
--
-- Verified live before the fix: a student inserted a shaping_chunk_outputs
-- row on their own shaping sheet referencing another student's chunk, and a
-- commentary_items row on their own chunk referencing another student's
-- concrete detail. Both were accepted.
--
-- WITH CHECK only, deliberately. USING governs which EXISTING rows a caller
-- may update or delete; adding the second parent there would make any row
-- that already carries a cross-writing reference undeletable by its owner,
-- which is the wrong response to data we do not want. WITH CHECK governs the
-- row's contents on INSERT and UPDATE, which is where the forgery happens.
--
-- SCOPE NOTE, so nobody reads more into this than it does: the predicate is
-- "the caller may write the second parent's writing", which closes the
-- student-vs-student graft the sweep found. It does NOT stop a TEACHER from
-- grafting across two of their own students, since auth_user_can_write_writing
-- is true for both. Closing that needs a same-writing invariant enforced by a
-- trigger rather than a policy — RLS is not an integrity mechanism and the
-- service role bypasses it entirely. Tracked in docs/BACKLOG.md.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS shaping_chunk_outputs_write ON shaping_chunk_outputs;

CREATE POLICY shaping_chunk_outputs_write ON shaping_chunk_outputs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shaping_sheets ss
      JOIN body_paragraphs bp ON bp.id = ss.body_paragraph_id
      WHERE ss.id = shaping_chunk_outputs.shaping_sheet_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shaping_sheets ss
      JOIN body_paragraphs bp ON bp.id = ss.body_paragraph_id
      WHERE ss.id = shaping_chunk_outputs.shaping_sheet_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
    -- chunk_id is NOT NULL, so no null branch here.
    AND EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp2 ON bp2.id = c.body_paragraph_id
      WHERE c.id = shaping_chunk_outputs.chunk_id
        AND auth_user_can_write_writing(bp2.student_writing_id)
    )
  );

DROP POLICY IF EXISTS commentary_items_write ON commentary_items;

CREATE POLICY commentary_items_write ON commentary_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = commentary_items.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = commentary_items.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
    -- parent_cd_id is nullable and legitimately so: a CM item need not hang
    -- off a specific CD. NULL must stay writable or every unattached
    -- commentary write breaks.
    AND (
      commentary_items.parent_cd_id IS NULL
      OR EXISTS (
        SELECT 1 FROM concrete_details cd
        JOIN chunks c2 ON c2.id = cd.chunk_id
        JOIN body_paragraphs bp2 ON bp2.id = c2.body_paragraph_id
        WHERE cd.id = commentary_items.parent_cd_id
          AND auth_user_can_write_writing(bp2.student_writing_id)
      )
    )
  );

COMMIT;
