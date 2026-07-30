-- ============================================================================
-- 0020 — Fictional Narrative ABC plan chain fields
-- ============================================================================
-- The ABC planning artifact (2018 Personal & Fictional Narrative Guide,
-- pp. 106-112) replaces the WOW T-Chart when narrative_kind = 'fictional'.
-- It has three parts on one page:
--   A = Gather Ideas  — nested-oval brainstorm; reuses narrative_key_word
--                       (center oval) + narrative_general_ideas (outer ring)
--   B = Breakdown     — concrete example; reuses narrative_concrete_example
--   C = The Plot      — a six-link story chain
--
-- The chain's first link ("Key") reuses narrative_key_word — per the guide
-- (pp. 106, 109, 112) it IS the key word/phrase of the prompt, the same
-- value as the A center oval. No abc_key_term column: that would duplicate
-- narrative_key_word (CLAUDE.md §14.3). Only the remaining five links get
-- their own columns.
--
-- All nullable TEXT, matching the other narrative_* extension columns on
-- t_charts (CLAUDE.md §7 — mode-specific extension columns live here).
-- ============================================================================

BEGIN;

ALTER TABLE t_charts
  ADD COLUMN abc_character  TEXT,
  ADD COLUMN abc_setting    TEXT,
  ADD COLUMN abc_back_story TEXT,
  ADD COLUMN abc_conflict   TEXT,
  ADD COLUMN abc_end        TEXT;

COMMIT;
