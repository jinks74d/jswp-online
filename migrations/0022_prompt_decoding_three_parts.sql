-- ---------------------------------------------------------------------------
-- 0022_prompt_decoding_three_parts.sql
--
-- Decoding the Prompt, per the JSWP method (2024 Expository guide pp.135-139,
-- "Designing and Decoding Prompts"), is splitting a prompt into three parts:
--   * Background sentence(s) — set the stage / name the topic
--   * Trigger sentence       — tells the writer WHERE to find concrete details
--   * Task                   — the specific assignment (length, mode, verb)
--
-- The original prompt_decodings table (0001) captured the task, form, ratio,
-- key verbs, focus terms, and notes — but not the background/trigger split,
-- and never the trigger's payoff question "Where will I find my CDs?" These
-- three nullable columns add that. cd_source holds the student's answer to
-- the "where will my concrete details come from?" prompt (the cognitive move
-- the decode step exists to teach).
--
-- Applies to every mode's decode step (decode is step 1 in all four modes).
-- All nullable — existing decodings load unchanged. RLS is inherited from the
-- existing prompt_decodings row-level policies (0002); no policy change.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE prompt_decodings
  ADD COLUMN background_text TEXT,
  ADD COLUMN trigger_text    TEXT,
  ADD COLUMN cd_source       TEXT;

COMMIT;
