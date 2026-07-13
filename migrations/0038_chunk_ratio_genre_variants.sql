-- 0038_chunk_ratio_genre_variants.sql
-- Replace the three generic chunk ratios with six genre-specific variants.
--
-- Before: jswp_chunk_ratio = two_plus_to_one | one_to_two_plus | three_plus_to_zero
--         (pure CD:CM proportion; genre lived only on assignments.mode).
-- After:  the enum encodes genre + proportion together so the student
--         prompt-decoding step can present genre-labelled choices:
--           lit_one_to_two_plus                (1:2+  literary analysis)
--           lit_three_plus_to_zero             (3+:0  literary plot summary)
--           nar_two_plus_to_one                (2+:1  personal/fictional narrative)
--           nonlit_summary_three_plus_to_zero  (3+:0  nonliterary summary)
--           nonlit_expository_two_plus_to_one  (2+:1  nonliterary expository)
--           nonlit_argumentation_two_plus_to_one (2+:1 nonliterary argumentation)
--
-- The underlying proportion (two_plus_to_one / one_to_two_plus /
-- three_plus_to_zero) still drives the writing-scaffold engine — application
-- code derives it via lib/jswp-modes.ts ratioClass().
--
-- Existing rows are backfilled by joining each row to its assignment's mode
-- (the only reliable genre signal): 1:2+ -> literary; 3+:0 -> literary vs
-- nonliterary summary by mode; 2+:1 -> narrative / argumentation / expository
-- by mode (expository is the default for any other mode).
--
-- Columns using the enum (all NOT NULL except ratio_identified):
--   assignments.default_chunk_ratio   (+ CHECK: literary must be 1:2+)
--   student_writings.chunk_ratio
--   prompt_decodings.ratio_identified (nullable)
--   chunks.ratio

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop the old literary CHECK constraint (it references 'one_to_two_plus',
--    which will no longer be a valid value). The constraint is unnamed in
--    0001, so discover and drop any CHECK on assignments that mentions it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'assignments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%one_to_two_plus%'
  LOOP
    EXECUTE format('ALTER TABLE assignments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Detach every column from the enum by casting to text, so we can remap
--    values (with cross-table joins) before the new enum exists.
-- ---------------------------------------------------------------------------
ALTER TABLE assignments
  ALTER COLUMN default_chunk_ratio TYPE text USING default_chunk_ratio::text;
ALTER TABLE student_writings
  ALTER COLUMN chunk_ratio TYPE text USING chunk_ratio::text;
ALTER TABLE prompt_decodings
  ALTER COLUMN ratio_identified TYPE text USING ratio_identified::text;
ALTER TABLE chunks
  ALTER COLUMN ratio TYPE text USING ratio::text;

-- ---------------------------------------------------------------------------
-- 3. Swap the type: drop the old enum (now unused) and create the new one.
-- ---------------------------------------------------------------------------
DROP TYPE jswp_chunk_ratio;
CREATE TYPE jswp_chunk_ratio AS ENUM (
  'lit_one_to_two_plus',
  'lit_three_plus_to_zero',
  'nar_two_plus_to_one',
  'nonlit_summary_three_plus_to_zero',
  'nonlit_expository_two_plus_to_one',
  'nonlit_argumentation_two_plus_to_one'
);

-- ---------------------------------------------------------------------------
-- 4. Backfill existing text values -> new genre-specific values, using the
--    assignment mode as the genre signal. Session-scoped helper.
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.map_ratio(old_val text, m jswp_mode) RETURNS text AS $$
  SELECT CASE old_val
    WHEN 'one_to_two_plus' THEN 'lit_one_to_two_plus'
    WHEN 'three_plus_to_zero' THEN
      CASE WHEN m = 'literary' THEN 'lit_three_plus_to_zero'
           ELSE 'nonlit_summary_three_plus_to_zero' END
    WHEN 'two_plus_to_one' THEN
      CASE m
        WHEN 'narrative' THEN 'nar_two_plus_to_one'
        WHEN 'argumentation' THEN 'nonlit_argumentation_two_plus_to_one'
        ELSE 'nonlit_expository_two_plus_to_one'
      END
    -- Already a new value (idempotent re-run) or unexpected: leave as-is.
    ELSE old_val
  END
$$ LANGUAGE sql IMMUTABLE;

UPDATE assignments
  SET default_chunk_ratio = pg_temp.map_ratio(default_chunk_ratio, mode);

UPDATE student_writings sw
  SET chunk_ratio = pg_temp.map_ratio(sw.chunk_ratio, a.mode)
  FROM assignments a
  WHERE a.id = sw.assignment_id;

UPDATE prompt_decodings pd
  SET ratio_identified = pg_temp.map_ratio(pd.ratio_identified, a.mode)
  FROM student_writings sw
  JOIN assignments a ON a.id = sw.assignment_id
  WHERE sw.id = pd.student_writing_id
    AND pd.ratio_identified IS NOT NULL;

UPDATE chunks c
  SET ratio = pg_temp.map_ratio(c.ratio, a.mode)
  FROM body_paragraphs bp
  JOIN student_writings sw ON sw.id = bp.student_writing_id
  JOIN assignments a ON a.id = sw.assignment_id
  WHERE bp.id = c.body_paragraph_id;

-- ---------------------------------------------------------------------------
-- 5. Re-attach each column to the new enum type.
-- ---------------------------------------------------------------------------
ALTER TABLE assignments
  ALTER COLUMN default_chunk_ratio TYPE jswp_chunk_ratio
  USING default_chunk_ratio::jswp_chunk_ratio;
ALTER TABLE student_writings
  ALTER COLUMN chunk_ratio TYPE jswp_chunk_ratio
  USING chunk_ratio::jswp_chunk_ratio;
ALTER TABLE prompt_decodings
  ALTER COLUMN ratio_identified TYPE jswp_chunk_ratio
  USING ratio_identified::jswp_chunk_ratio;
ALTER TABLE chunks
  ALTER COLUMN ratio TYPE jswp_chunk_ratio
  USING ratio::jswp_chunk_ratio;

-- ---------------------------------------------------------------------------
-- 6. Restore the mode/ratio sanity check, expressed in the new terms:
--    literary assignments use a lit_* ratio; everything else uses a non-lit
--    ratio. (Mirrors the original literary-locked intent.)
-- ---------------------------------------------------------------------------
ALTER TABLE assignments
  ADD CONSTRAINT assignments_mode_ratio_check CHECK (
    (mode = 'literary'
       AND default_chunk_ratio IN ('lit_one_to_two_plus', 'lit_three_plus_to_zero'))
    OR (mode <> 'literary'
       AND default_chunk_ratio NOT IN ('lit_one_to_two_plus', 'lit_three_plus_to_zero'))
  );

COMMIT;
