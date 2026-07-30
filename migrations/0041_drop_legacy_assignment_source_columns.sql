-- ============================================================================
-- 0041 — Drop the legacy per-assignment source columns (multi-source cutover)
-- ============================================================================
-- 0040 introduced assignment_sources (one row per source) and backfilled the
-- existing single source into it. Every application reader has since been cut
-- over to assignment_sources, so the legacy columns on `assignments` are dead.
-- This drops them. Their CHECK constraint (source_render_mode, from 0025) drops
-- automatically with the column.
--
-- Annotations already carry source_id (backfilled in 0040); the offset
-- substrate now lives per-source on assignment_sources.source_text.
-- ============================================================================

BEGIN;

ALTER TABLE assignments
  DROP COLUMN IF EXISTS source_text,
  DROP COLUMN IF EXISTS source_title,
  DROP COLUMN IF EXISTS source_author,
  DROP COLUMN IF EXISTS source_citation,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS source_html,
  DROP COLUMN IF EXISTS source_render_mode,
  DROP COLUMN IF EXISTS source_file_path,
  DROP COLUMN IF EXISTS source_file_name,
  DROP COLUMN IF EXISTS source_file_mime;

COMMIT;
