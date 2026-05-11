-- ============================================================================
-- 0010 — Fix word-count trigger
-- ============================================================================
-- The shared trigger function from 0001 (trigger_set_word_count) references
-- COALESCE(NEW.final_text, NEW.full_text, ''). Postgres binds NEW.<col>
-- against the actual table rowtype at trigger execution, so:
--   - paragraph_forms (has final_text, no full_text) fails on NEW.full_text
--   - final_drafts    (has full_text, no final_text) fails on NEW.final_text
-- with: record "new" has no field "<col>".
--
-- Fix: drop the shared function (CASCADE drops both triggers) and replace
-- with one trigger function per table that only references its own column.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS trigger_set_word_count() CASCADE;

CREATE OR REPLACE FUNCTION trigger_set_word_count_paragraph_forms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.word_count := COALESCE(
    array_length(
      regexp_split_to_array(NULLIF(trim(COALESCE(NEW.final_text, '')), ''), '\s+'),
      1
    ),
    0
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_set_word_count_final_drafts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.word_count := COALESCE(
    array_length(
      regexp_split_to_array(NULLIF(trim(COALESCE(NEW.full_text, '')), ''), '\s+'),
      1
    ),
    0
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_word_count_paragraph_forms
  BEFORE INSERT OR UPDATE OF final_text ON paragraph_forms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_word_count_paragraph_forms();

CREATE TRIGGER set_word_count_final_drafts
  BEFORE INSERT OR UPDATE OF full_text ON final_drafts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_word_count_final_drafts();

COMMIT;
