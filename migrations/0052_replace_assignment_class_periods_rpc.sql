-- ============================================================================
-- 0052 — Atomic replace of an assignment's class periods
-- ============================================================================
-- `writeAssignmentPeriods` (lib/actions/assignments.ts) replaced an
-- assignment's periods with two separate PostgREST calls:
--
--     DELETE FROM assignment_class_periods WHERE assignment_id = ...
--     INSERT INTO assignment_class_periods (...) VALUES (...)
--
-- Postgres wraps each STATEMENT in its own transaction, but nothing wrapped
-- the pair. If the DELETE committed and the INSERT then failed — the 0051
-- same-school RLS check rejecting a period, a duplicate key, a dropped
-- connection — the assignment was left with ZERO periods and the action
-- returned an error the teacher reasonably reads as "nothing was saved".
--
-- That is reachable with student work in flight. unpublishAssignment permits
-- unpublishing even when students have started writing (their rows are
-- preserved), which returns the assignment to draft, where this REPLACE path
-- applies rather than the additive published path. A half-failed save there
-- silently drops every period; re-publishing then hands the assignment to
-- nobody, and students who had work in progress lose access to it.
--
-- The fix is one plpgsql function: its body executes inside a single
-- transaction, so a failing INSERT rolls the DELETE back with it. Either the
-- new set of periods lands or the old set is untouched. There is no window.
--
-- SECURITY INVOKER is deliberate and load-bearing. This function must NOT be
-- SECURITY DEFINER: that would run it as the owner and bypass RLS on
-- assignment_class_periods, converting an authorization boundary into a hole.
-- Invoker keeps the caller's identity, so the 0051 write policy
-- (auth_user_can_write_assignment AND auth_user_can_assign_to_period) still
-- governs every row. This migration changes atomicity ONLY — never who may
-- write what.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The atomic replace.
--    Takes the period set as JSONB so one call carries N rows:
--      [{"class_period_id": "<uuid>", "due_at": "2026-03-04T00:00:00Z" | null}]
--    due_at NULL means "inherit assignments.due_at", per 0050.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION replace_assignment_class_periods(
  p_assignment_id UUID,
  p_periods       JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- RLS applies to this DELETE. A row the caller cannot write is filtered
  -- rather than erroring, which matches the pre-RPC behaviour exactly.
  DELETE FROM assignment_class_periods
  WHERE assignment_id = p_assignment_id;

  -- An empty set is a legitimate outcome (a draft with no classes chosen yet),
  -- so this is not an error path — just nothing to insert.
  IF jsonb_array_length(COALESCE(p_periods, '[]'::jsonb)) = 0 THEN
    RETURN;
  END IF;

  -- Any RLS rejection here raises, and the DELETE above rolls back with it.
  INSERT INTO assignment_class_periods (assignment_id, class_period_id, due_at)
  SELECT
    p_assignment_id,
    (elem ->> 'class_period_id')::UUID,
    NULLIF(elem ->> 'due_at', '')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_periods) AS elem;
END;
$$;

COMMENT ON FUNCTION replace_assignment_class_periods(UUID, JSONB) IS
  'Atomically replace an assignment''s class periods. SECURITY INVOKER so the '
  '0051 write policy still governs every row — do not change to DEFINER.';

-- ---------------------------------------------------------------------------
-- 2. Callable by signed-in users only. RLS inside the function is what
--    actually authorizes the write; this just opens the door to authenticated.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION replace_assignment_class_periods(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_assignment_class_periods(UUID, JSONB) TO authenticated;

COMMIT;
