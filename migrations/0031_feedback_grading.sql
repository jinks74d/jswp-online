-- 0031_feedback_grading.sql
-- Lightweight feedback-area grading: a per-writing grade format, a grade on
-- each section (on the per-section teacher_feedback row), and one overall
-- grade (writing-level). Independent of rubric / total_score / "Mark graded".
CREATE TYPE jswp_grade_format AS ENUM ('none', 'number', 'letter', 'check');

ALTER TABLE student_writings
  ADD COLUMN IF NOT EXISTS grade_format jswp_grade_format NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overall_grade TEXT NULL;

ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS grade_value TEXT NULL;

COMMENT ON COLUMN student_writings.grade_format IS
  'Feedback-area grade format chosen by the teacher (none=off). Drives the GradeInput control for section + overall grades. Independent of total_score. Migration 0031.';
COMMENT ON COLUMN student_writings.overall_grade IS
  'The single overall feedback grade (TEXT; interpreted per grade_format). Migration 0031.';
COMMENT ON COLUMN teacher_feedback.grade_value IS
  'Per-section grade (TEXT; interpreted per the writing''s grade_format). Meaningful only on section rows (step_key set). Migration 0031.';
