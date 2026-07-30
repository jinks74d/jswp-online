-- ============================================================================
-- 0016 — Exemplar step tags (chunk 6.5)
-- ============================================================================
-- Per-step tagging so students see exemplars matching the writing flow's
-- current step. Tags are mode-agnostic GroupOrigin strings (e.g.,
-- "thesis", "paragraph_form") from lib/jswp-modes.ts; the exemplar's
-- existing mode column scopes them.
--
-- Schema convention (CLAUDE.md §7): the DB doesn't know the step list.
-- step_tags is TEXT[], not an enum array — value-set lives in
-- lib/exemplar-limits.ts. No CHECK constraint here; app validates.
--
-- NULL = "general / mode-default." Existing exemplars from 6.1-6.4 carry
-- NULL and continue to work in the student panel's fallback path.
-- ============================================================================

BEGIN;

ALTER TABLE exemplars
  ADD COLUMN step_tags TEXT[];

-- Partial GIN index for `step_tags @> ARRAY['…']` lookups. Rows without
-- tags don't appear in step-filtered queries, so excluding them keeps
-- the index small.
CREATE INDEX idx_exemplars_step_tags
  ON exemplars USING GIN (step_tags)
  WHERE step_tags IS NOT NULL;

COMMIT;
