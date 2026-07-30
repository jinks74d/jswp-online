-- 0039_expository_one_to_one_ratio.sql
-- Add a 1:1 (one CD : one CM) chunk ratio, EXPOSITORY-only.
--
-- Context: migration 0038 replaced the three generic ratios with six
-- genre-specific variants. This adds a seventh for expository assignments
-- that pace one sentence of concrete detail to one sentence of commentary
-- (e.g. APUSH / AP World History document-based writing).
--
-- Why no CHECK-constraint change: the mode/ratio guard added in 0038
-- (assignments_mode_ratio_check) only asserts that literary assignments use a
-- lit_* ratio and non-literary assignments do NOT. 'nonlit_expository_one_to_one'
-- is a non-lit value on a non-literary (expository) assignment, so it satisfies
-- the existing constraint automatically — no constraint edit required.
--
-- Why no transaction wrapper: Postgres forbids USING a new enum value in the
-- same transaction that adds it. We only ADD the value here (no data touches
-- it), so a bare, idempotent ADD VALUE is the safe form.

ALTER TYPE jswp_chunk_ratio ADD VALUE IF NOT EXISTS 'nonlit_expository_one_to_one';
