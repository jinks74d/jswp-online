-- ---------------------------------------------------------------------------
-- 0027_classes_description.sql
--
-- The combined "Add a subject & class" form captures a per-class description
-- ("American Literature — 11th grade survey"). subjects.description already
-- exists but is shared across every class under a subject, so a class-level
-- description is the right home. Nullable; existing classes are unaffected.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE classes ADD COLUMN description TEXT;

COMMIT;
