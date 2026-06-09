-- 0030_teacher_feedback_step_key.sql
-- Per-section (step-anchored) teacher feedback. A section note is a
-- teacher_feedback row with step_key set (e.g. 'expository.t_chart');
-- the overall threaded comment keeps step_key NULL. The unique index
-- enforces one section note per (writing, teacher, step). NULLs are
-- distinct, so multiple overall rows remain legal, and the full (not
-- partial) index is a valid ON CONFLICT target for the upsert.
ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS step_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_teacher_feedback_section
  ON teacher_feedback (student_writing_id, teacher_id, step_key);

COMMENT ON COLUMN teacher_feedback.step_key IS
  'Section anchor: the step key (e.g. expository.t_chart) a section note targets. NULL = overall whole-writing comment (the threaded panel). One note per (writing, teacher, step) via ux_teacher_feedback_section. Migration 0030.';
