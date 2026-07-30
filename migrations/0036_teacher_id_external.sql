-- 0036_teacher_id_external.sql
-- Teachers gain an optional external/staff identifier, mirroring
-- student_id_external. Captured when a school admin adds a teacher; nullable so
-- schools that don't track teacher IDs are unaffected.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS teacher_id_external VARCHAR(50);

COMMENT ON COLUMN user_profiles.teacher_id_external IS 'Optional external/staff ID for a teacher (school-assigned). Mirrors student_id_external.';
