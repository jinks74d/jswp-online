-- ============================================================================
-- 0019 — Narrative Shaping Sheet shape-block fields
-- ============================================================================
-- The narrative Shaping Sheet (2018 Personal & Fictional Narrative Guide,
-- pp. 64/70) is five stacked shape-blocks: TS trapezoid, 1st CD rectangle,
-- 2nd CD rectangle, CM ellipse, CS trapezoid. These are composed sentences
-- the student writes AFTER studying their T-Chart WOW notes — they are not
-- the raw narrative_when / narrative_where fields, so they need their own
-- storage.
--
-- TS and CS already have homes on shaping_sheets (final_topic_sentence,
-- final_concluding_sentence) — the trapezoid blocks bind to those. Only the
-- three middle blocks are genuinely new:
--   * narrative_shaping_cd1 — 1st Concrete Detail sentence
--   * narrative_shaping_cd2 — 2nd Concrete Detail sentence
--   * narrative_shaping_cm  — Commentary sentence
--
-- All nullable TEXT. No narrative_shaping_ts / _cs columns: those would
-- duplicate final_topic_sentence / final_concluding_sentence (CLAUDE.md
-- §14.3 — mode value in two places drifts).
-- ============================================================================

BEGIN;

ALTER TABLE shaping_sheets
  ADD COLUMN narrative_shaping_cd1 TEXT,
  ADD COLUMN narrative_shaping_cd2 TEXT,
  ADD COLUMN narrative_shaping_cm  TEXT;

COMMIT;
