-- ---------------------------------------------------------------------------
-- 0055 — Let a student submit an individual step for grading
-- ---------------------------------------------------------------------------
--
-- Per-step GRADING already exists: teacher_feedback carries step_key (0030)
-- and grade_value (0031), and the review surface renders a graded section note
-- under every step. What was missing is the student's half of that exchange —
-- a way to say "this step is ready to look at" — and therefore any way for the
-- teacher to tell which steps are waiting on her.
--
-- `completed_at` cannot serve: it means "clicked Continue and moved on", which
-- every step acquires simply by being walked past. Submitting is a deliberate,
-- repeatable act and needs its own clock.
--
-- Deliberately NOT a lock. Submitting a step leaves it editable (decided with
-- Raymond 2026-08-12); a student who submits early must never be stranded
-- waiting for a teacher to release them. A later edit re-flags the writing
-- through the 0054 last_student_edit_at trigger, so a stale grade is visible
-- rather than silent.
--
-- NEEDS LIVE SUPABASE APPLY.
-- ---------------------------------------------------------------------------

ALTER TABLE step_progress
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN step_progress.submitted_at IS
  'When the student last submitted THIS STEP for grading. Independent of '
  'completed_at (which only means they clicked Continue) and of '
  'student_writings.status (which governs the whole submission). Re-submitting '
  'after an edit overwrites it, so it always reads as "ready as of". '
  'NULL = never submitted. Migration 0055.';

-- Partial index: the teacher-side reads only ever ask for submitted steps, and
-- most rows are NULL.
CREATE INDEX IF NOT EXISTS idx_step_progress_submitted
  ON step_progress (student_writing_id, submitted_at)
  WHERE submitted_at IS NOT NULL;
