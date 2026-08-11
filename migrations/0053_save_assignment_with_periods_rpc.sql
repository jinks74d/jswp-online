-- ============================================================================
-- 0053 — Save an assignment's row and its class periods in one transaction
-- ============================================================================
-- 0052 made the PERIOD write atomic with itself. It did not make the period
-- write atomic with the `assignments` row update that follows it, and
-- updateAssignment still does those as two calls, periods first:
--
--     replace/append assignment_class_periods   <- 0052, atomic internally
--     UPDATE assignments SET title = ..., ...   <- separate call
--
-- So a failing row update leaves periods already rewritten against a row that
-- never changed: the teacher moved Period 3 to a new due date, the update then
-- failed, and now the junction says one thing while the assignment says
-- another. No data is destroyed — this is milder than the bug 0052 fixed — but
-- the two halves of one save can still disagree, and the teacher is told the
-- save failed while half of it landed.
--
-- This folds both into a single plpgsql function so they share one
-- transaction. Either the whole save lands or none of it does.
--
-- p_update carries only the columns this save is allowed to touch, and the
-- function whitelists them explicitly rather than splatting the JSONB into the
-- row. Key PRESENCE decides: absent leaves the column alone, present sets it
-- (including to NULL, which is how a rubric document is detached). That keeps
-- one function serving both callers — the published branch sends three or four
-- keys, the draft branch sends a dozen — without either being able to reach a
-- column it has no business writing, such as teacher_id, school_id, mode, or
-- released_at.
--
-- SECURITY INVOKER, for the same load-bearing reason as 0052: RLS on both
-- `assignments` and `assignment_class_periods` must still apply as the caller.
-- The explicit teacher_id filter on the UPDATE is also preserved from the
-- TypeScript it replaces — `assignments_coteacher_update` would otherwise let
-- a co-teacher through a path that previously only the owner could use, and
-- this migration is not the place to widen that.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION save_assignment_with_periods(
  p_assignment_id UUID,
  p_teacher_id    UUID,
  p_periods       JSONB,
  -- TRUE  → draft path: the period set is REPLACED with exactly p_periods.
  -- FALSE → published path: p_periods is merged in, never removing a period,
  --         because students there may already have work in progress.
  p_replace       BOOLEAN,
  p_update        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ---- 1. Class periods -------------------------------------------------
  IF p_replace THEN
    DELETE FROM assignment_class_periods
    WHERE assignment_id = p_assignment_id;
  END IF;

  IF jsonb_array_length(COALESCE(p_periods, '[]'::jsonb)) > 0 THEN
    INSERT INTO assignment_class_periods (assignment_id, class_period_id, due_at)
    SELECT
      p_assignment_id,
      (elem ->> 'class_period_id')::UUID,
      NULLIF(elem ->> 'due_at', '')::TIMESTAMPTZ
    FROM jsonb_array_elements(p_periods) AS elem
    ON CONFLICT (assignment_id, class_period_id) DO UPDATE
      SET due_at = EXCLUDED.due_at;
  END IF;

  -- ---- 2. The assignment row -------------------------------------------
  -- jsonb_exists(...) rather than the `?` operator: `?` is a placeholder in
  -- several client drivers and reads ambiguously here even though this body
  -- is parsed by Postgres alone.
  UPDATE assignments SET
    title = CASE WHEN jsonb_exists(p_update, 'title')
      THEN (p_update ->> 'title')::VARCHAR(255) ELSE title END,

    prompt = CASE WHEN jsonb_exists(p_update, 'prompt')
      THEN p_update ->> 'prompt' ELSE prompt END,

    due_at = CASE WHEN jsonb_exists(p_update, 'due_at')
      THEN NULLIF(p_update ->> 'due_at', '')::TIMESTAMPTZ ELSE due_at END,

    class_period_id = CASE WHEN jsonb_exists(p_update, 'class_period_id')
      THEN NULLIF(p_update ->> 'class_period_id', '')::UUID
      ELSE class_period_id END,

    is_essay = CASE WHEN jsonb_exists(p_update, 'is_essay')
      THEN (p_update ->> 'is_essay')::BOOLEAN ELSE is_essay END,

    num_body_paragraphs = CASE WHEN jsonb_exists(p_update, 'num_body_paragraphs')
      THEN (p_update ->> 'num_body_paragraphs')::SMALLINT
      ELSE num_body_paragraphs END,

    default_chunk_ratio = CASE WHEN jsonb_exists(p_update, 'default_chunk_ratio')
      THEN (p_update ->> 'default_chunk_ratio')::jswp_chunk_ratio
      ELSE default_chunk_ratio END,

    default_chunks_per_bp = CASE WHEN jsonb_exists(p_update, 'default_chunks_per_bp')
      THEN (p_update ->> 'default_chunks_per_bp')::SMALLINT
      ELSE default_chunks_per_bp END,

    has_counterargument = CASE WHEN jsonb_exists(p_update, 'has_counterargument')
      THEN (p_update ->> 'has_counterargument')::BOOLEAN
      ELSE has_counterargument END,

    -- rubric is a JSONB column, so take the VALUE (->) not its text (->>).
    rubric = CASE WHEN jsonb_exists(p_update, 'rubric')
      THEN p_update -> 'rubric' ELSE rubric END,

    rubric_file_path = CASE WHEN jsonb_exists(p_update, 'rubric_file_path')
      THEN p_update ->> 'rubric_file_path' ELSE rubric_file_path END,

    rubric_file_name = CASE WHEN jsonb_exists(p_update, 'rubric_file_name')
      THEN p_update ->> 'rubric_file_name' ELSE rubric_file_name END,

    rubric_file_mime = CASE WHEN jsonb_exists(p_update, 'rubric_file_mime')
      THEN p_update ->> 'rubric_file_mime' ELSE rubric_file_mime END
  WHERE id = p_assignment_id
    AND teacher_id = p_teacher_id;
END;
$$;

COMMENT ON FUNCTION save_assignment_with_periods(UUID, UUID, JSONB, BOOLEAN, JSONB) IS
  'Atomically save an assignment row and its class periods. SECURITY INVOKER '
  'so RLS still governs both tables — do not change to DEFINER. p_update is a '
  'whitelist: keys outside the CASE list are ignored by construction.';

REVOKE ALL ON FUNCTION save_assignment_with_periods(UUID, UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_assignment_with_periods(UUID, UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

COMMIT;
