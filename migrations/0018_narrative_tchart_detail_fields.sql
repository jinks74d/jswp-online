-- ============================================================================
-- 0018 — Narrative T-Chart detail fields
-- ============================================================================
-- The 2018 Personal & Fictional Narrative Guide (pp. 63/69) lays the WOW
-- T-Chart out as a two-column form. The left ("CDs") column pairs each of
-- When / Where / Who with a "Details about …" sub-block of writing lines;
-- the right ("CMs") column has TWO "What were you thinking? Why?" cloud
-- bubbles flanking the central "I was feeling…" oval.
--
-- The original schema (0001) collapsed each concept to a single column.
-- These four columns restore the guide's distinct writing spaces:
--   * narrative_when_details / _where_details / _who_details
--       — the sub-detail lines under each When/Where/Who prompt
--   * narrative_thinking_2
--       — the second ("lower") thinking cloud; narrative_thinking is the first
--
-- All nullable TEXT, matching the existing narrative_* columns on t_charts.
-- No prompt column (the prompt renders from the assignment in the step
-- chrome) and no topic-sentence column (the T-Chart shows it read-only,
-- sourced from the dedicated topic-sentences step's working_topic_sentence).
-- ============================================================================

BEGIN;

ALTER TABLE t_charts
  ADD COLUMN narrative_when_details  TEXT,
  ADD COLUMN narrative_where_details TEXT,
  ADD COLUMN narrative_who_details   TEXT,
  ADD COLUMN narrative_thinking_2    TEXT;

COMMIT;
