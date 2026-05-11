-- ============================================================================
-- 0011 — Rubric scores
-- ============================================================================
-- Per-criterion grading data for chunk 5.1. Replaces 4.7b's optional numeric
-- score with structured rubric data. Snapshot fields (criterion_name,
-- max_score, level_label) protect historical grades from later rubric edits
-- on assignments.rubric.
--
-- Aggregation: student_writings.total_score is maintained in the app-layer
-- grading action (sum over rubric_scores.score for the writing), not via a
-- trigger — keeps the logic in one place with the status transition.
--
-- RLS mirrors the teacher_feedback pattern:
--   - SELECT: anyone who can read the writing (owner OR teacher/admin scope)
--   - INSERT/UPDATE/DELETE: writing scope AND caller has teacher/admin role,
--     which keeps the student-as-owner branch of auth_user_can_write_writing
--     from inserting scores on their own work.
-- ============================================================================

BEGIN;

CREATE TABLE rubric_scores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  criterion_id       UUID NOT NULL,
  criterion_name     VARCHAR(100) NOT NULL,
  max_score          NUMERIC(5,2) NOT NULL,
  score              NUMERIC(5,2) NOT NULL
                       CHECK (score >= 0 AND score <= max_score),
  level_label        VARCHAR(50),
  comment            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_writing_id, criterion_id)
);

CREATE INDEX idx_rubric_scores_writing ON rubric_scores(student_writing_id);

-- 0001's bulk DO block creates set_updated_at on every table with an
-- updated_at column at migration time. New tables added later need the
-- trigger added explicitly.
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON rubric_scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE rubric_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY rubric_scores_read ON rubric_scores
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));

CREATE POLICY rubric_scores_teacher_write ON rubric_scores
  FOR ALL TO authenticated
  USING (
    auth_user_can_write_writing(student_writing_id)
    AND auth_user_role() IN (
      'teacher', 'school_admin', 'district_admin', 'super_admin'
    )
  )
  WITH CHECK (
    auth_user_can_write_writing(student_writing_id)
    AND auth_user_role() IN (
      'teacher', 'school_admin', 'district_admin', 'super_admin'
    )
  );

COMMIT;
