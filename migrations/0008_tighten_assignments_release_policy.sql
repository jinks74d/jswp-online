-- ============================================================================
-- JSWP Online — Tighten student read policy on assignments (0008)
-- ============================================================================
-- Migration 0002 created assignments_student_read with the clause
--   (released_at IS NULL OR released_at <= NOW())
-- which treats a NULL released_at as "released by default."
--
-- This contradicts the Phase 3 publish/unpublish contract that uses NULL
-- to mean "draft, not yet published." Under the original policy, a teacher
-- creating an assignment without explicitly setting released_at would have
-- it immediately visible to enrolled students — the opposite of the intent.
--
-- This migration rewrites the policy so NULL released_at means hidden:
--   class_period_id IS NOT NULL
--   AND auth_user_enrolled_in_class_period(class_period_id)
--   AND released_at IS NOT NULL
--   AND released_at <= NOW()
--
-- Teacher / admin / co-teacher policies are unchanged — they still see
-- unreleased assignments, which is correct for authoring and oversight.
--
-- Safe to run idempotently: DROP POLICY IF EXISTS handles re-runs.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS assignments_student_read ON assignments;

CREATE POLICY assignments_student_read ON assignments
  FOR SELECT TO authenticated
  USING (
    class_period_id IS NOT NULL
    AND auth_user_enrolled_in_class_period(class_period_id)
    AND released_at IS NOT NULL
    AND released_at <= NOW()
  );

COMMIT;
