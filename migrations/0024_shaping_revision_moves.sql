-- ---------------------------------------------------------------------------
-- 0024_shaping_revision_moves.sql
--
-- The JSWP Shaping Sheet is defined by five revision "moves" (2024 Expository
-- guide glossary pp.151-152): (1) add transitions between ideas, (2) vary
-- sentence openings, (3) use different sentence types (simple/compound/
-- complex/compound-complex), (4) fix spelling/punctuation/capitalization,
-- (5) add or delete words to create voice. This column tracks which moves a
-- student has self-checked on each shaping sheet (a non-blocking checklist).
--
-- Stored as TEXT[] of move keys: 'transitions', 'vary_openings',
-- 'sentence_types', 'mechanics', 'voice'.
--
-- Kept deliberately separate from shaping_sheets.rules_applied, which is
-- reserved for Dr. Louis's 15 Grammar Rules (a distinct, content-blocked
-- surface). Nullable, no default — existing rows load as NULL (treated as
-- empty). RLS inherited from the existing shaping_sheets policies (0002).
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE shaping_sheets ADD COLUMN revision_moves TEXT[];

COMMIT;
