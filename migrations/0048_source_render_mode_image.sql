-- 0048_source_render_mode_image.sql
--
-- Teachers can now attach a .png / .jpg source (a photographed page, a chart,
-- a political cartoon, a primary-source scan). Those render as a picture, so
-- they need a fourth render mode alongside 'pdf' / 'rich' / 'plain'.
--
-- An image source carries NO source_text: there is nothing for the annotation
-- engine to index offsets into, so the student sees the image and the annotate
-- step releases its Continue gate the same way a scanned (text-free) PDF does.
-- The picture itself lives in the assignment-sources bucket, which has allowed
-- image/png + image/jpeg since 0003 — no storage change needed here.
--
-- The constraint is the inline one from 0040, which Postgres auto-named
-- assignment_sources_source_render_mode_check.

BEGIN;

ALTER TABLE assignment_sources
  DROP CONSTRAINT IF EXISTS assignment_sources_source_render_mode_check;

ALTER TABLE assignment_sources
  ADD CONSTRAINT assignment_sources_source_render_mode_check
  CHECK (source_render_mode IS NULL
         OR source_render_mode IN ('pdf', 'rich', 'plain', 'image'));

COMMIT;
