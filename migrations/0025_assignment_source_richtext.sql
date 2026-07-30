-- ============================================================================
-- 0025 — Rich / PDF-native source text (Chunk 1: teacher source layer)
-- ============================================================================
-- Make the assignment source first-class without disturbing the annotation
-- engine. text_annotations.range_start/range_end are character offsets into
-- assignments.source_text — that column stays the canonical substrate and is
-- left untouched here.
--
-- New columns (all nullable; existing rows read as render_mode = NULL = plain):
--   source_file_path / _name / _mime  — the stored original in the
--                                        assignment-sources bucket (Open original)
--   source_html                       — sanitized rich-text body (rich mode)
--   source_render_mode                — how the student/teacher view renders it
--
-- No new tables, indexes, or RLS — these columns ride the existing assignments
-- policies, and the file rides the existing school-scoped assignment-sources
-- bucket. See docs/SOURCE_TEXT_ARCHITECTURE.md.
-- ============================================================================

BEGIN;

ALTER TABLE assignments
  ADD COLUMN source_file_path   TEXT,
  ADD COLUMN source_file_name   TEXT,
  ADD COLUMN source_file_mime   TEXT,
  ADD COLUMN source_html        TEXT,
  ADD COLUMN source_render_mode TEXT
    CHECK (source_render_mode IS NULL
           OR source_render_mode IN ('pdf', 'rich', 'plain'));

COMMIT;
