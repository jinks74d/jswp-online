-- 0045_web_word_uses.sql
-- Pick-n-Stitch tracking for the Expository T-Chart's commentary "cloud" rays.
--
-- "Once you use it, you lose it": a commentary word or phrase spent on one
-- sentence cannot be spent again. commentary_items already tracks this for
-- the item's own text (used_in_topic_sentence / used_in_cm_sentence /
-- used_in_concluding_sentence, migration 0001) — that covers the sentence in
-- the cloud's oval. But the four brainstormed ray phrases live in the
-- web_words TEXT[] (migration 0037), which has no per-slot state, so a
-- student had no way to see which rays were already spent.
--
-- This adds a parallel array: web_word_uses[i] records where web_words[i]
-- was used. Index-aligned with web_words exactly as the ray positions are,
-- and written as a whole array by the same action, so the two cannot drift.
--
-- Allowed values: 'ts' (Revised Topic Sentence), 'cm' (Commentary Sentence),
-- 'cs' (Concluding Sentence), or '' / NULL for an unused slot. One value per
-- slot, not a set — that single-valued shape is what enforces the rule.
-- Validated in lib/actions/t-charts.ts rather than by a CHECK, since a
-- per-element array constraint would need a trigger to express.

ALTER TABLE commentary_items
  ADD COLUMN IF NOT EXISTS web_word_uses TEXT[];

COMMENT ON COLUMN commentary_items.web_word_uses IS
  'Pick-n-Stitch: where each web_words entry was spent. Index-aligned with web_words. Values: ts | cm | cs | empty (unused). One per slot — "once you use it, you lose it."';
