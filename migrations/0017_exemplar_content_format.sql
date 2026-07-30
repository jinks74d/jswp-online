-- ============================================================================
-- 0017 — Exemplar content format (chunk 6.6a)
-- ============================================================================
-- Adds a content_format flag so an exemplar's full_text can store either
-- plain text (backward-compatible default) or sanitized HTML carrying
-- JSWP color-code spans (jswp-ts, jswp-cd, jswp-cm, etc.).
--
-- Sanitization happens at the app layer (lib/exemplar-content.ts) on
-- every write. The DB doesn't validate markup; the CHECK constraint only
-- restricts the format flag itself.
--
-- All existing rows default to 'plain'. The 6.1-6.5 read paths continue
-- to work unchanged; ExemplarRender branches on this column.
-- ============================================================================

BEGIN;

ALTER TABLE exemplars
  ADD COLUMN content_format TEXT NOT NULL DEFAULT 'plain'
    CHECK (content_format IN ('plain', 'html'));

COMMIT;
