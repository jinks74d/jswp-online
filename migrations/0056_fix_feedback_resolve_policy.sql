-- ---------------------------------------------------------------------------
-- 0056 — Repair the student "mark feedback resolved" policy
-- ---------------------------------------------------------------------------
--
-- The bug
-- -------
-- teacher_feedback_student_resolve (0002) pinned the immutable columns like
-- this:
--
--   teacher_id = (SELECT teacher_id FROM teacher_feedback
--                  WHERE id = teacher_feedback.id)
--
-- Inside that subquery, `teacher_feedback` resolves to the SUBQUERY'S OWN
-- table, not the row being updated. So the predicate is `WHERE id = id` —
-- always true — and the scalar subquery returns every row in the table.
-- Postgres then raises:
--
--   more than one row returned by a subquery used as an expression
--
-- It only ever appeared to work while teacher_feedback held a single row,
-- which is why it survived to production: with 0 or 1 rows the subquery is a
-- legal scalar. Marking feedback resolved has been broken for every student
-- since the table gained a second row.
--
-- The second bug, which the first was hiding
-- ------------------------------------------
-- The pin listed only the columns that existed in 0002. `step_key` (0030),
-- `grade_value` (0031) and `rubric_score` were never covered, so the policy
-- as written would have let a student rewrite their own per-section GRADE
-- while "resolving" a note. That never became exploitable only because the
-- broken subquery made every student UPDATE error out — it failed closed.
-- Fixing the subquery without also pinning those columns would have opened
-- it, so both are fixed together here.
--
-- The fix
-- -------
-- One EXISTS with the inner table aliased, so `teacher_feedback.<col>`
-- unambiguously means the NEW row and `tf.<col>` the stored one. Within an
-- UPDATE the subquery reads the pre-update snapshot, so this compares NEW
-- against OLD as intended.
--
-- IS NOT DISTINCT FROM, not `=`: step_key, grade_value and rubric_score are
-- nullable, and `NULL = NULL` yields NULL, which fails a WITH CHECK. Plain
-- equality would have blocked resolving any note without a grade — i.e. most
-- of them.
--
-- MAINTENANCE: every column except is_resolved and updated_at must be listed
-- below. A new column added to teacher_feedback without a line here becomes
-- student-writable. That is precisely how step_key and grade_value slipped.
--
-- NEEDS LIVE SUPABASE APPLY.
-- ---------------------------------------------------------------------------

BEGIN;

DROP POLICY IF EXISTS teacher_feedback_student_resolve ON teacher_feedback;

CREATE POLICY teacher_feedback_student_resolve ON teacher_feedback
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_writings sw
      WHERE sw.id = teacher_feedback.student_writing_id
        AND sw.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM teacher_feedback tf
      WHERE tf.id = teacher_feedback.id
        AND tf.student_writing_id IS NOT DISTINCT FROM teacher_feedback.student_writing_id
        AND tf.teacher_id         IS NOT DISTINCT FROM teacher_feedback.teacher_id
        AND tf.target_kind        IS NOT DISTINCT FROM teacher_feedback.target_kind
        AND tf.target_id          IS NOT DISTINCT FROM teacher_feedback.target_id
        AND tf.body               IS NOT DISTINCT FROM teacher_feedback.body
        AND tf.step_key           IS NOT DISTINCT FROM teacher_feedback.step_key
        AND tf.grade_value        IS NOT DISTINCT FROM teacher_feedback.grade_value
        AND tf.rubric_score       IS NOT DISTINCT FROM teacher_feedback.rubric_score
        AND tf.created_at         IS NOT DISTINCT FROM teacher_feedback.created_at
    )
  );

COMMIT;
