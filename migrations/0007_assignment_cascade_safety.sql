-- ============================================================================
-- JSWP Online — Assignment cascade safety (0007)
-- ============================================================================
-- The FK from student_writings.assignment_id to assignments(id) was
-- originally created with ON DELETE CASCADE in migration 0001 (line 253).
-- That meant a teacher (or any admin) deleting an assignment would silently
-- vaporize every related student_writings row, AND every artifact dangling
-- below those rows via further ON DELETE CASCADE chains (chunks, CDs, CMs,
-- t_charts, body_paragraphs, etc.).
--
-- Lost student work is the worst-case outcome the app can produce.
-- This migration switches the FK to ON DELETE RESTRICT so Postgres itself
-- refuses the delete while writings exist. The application layer (the
-- deleteAssignment server action in lib/actions/assignments.ts) does its
-- own count check first to surface a friendly error message — but the DB
-- constraint is the real safety net, protecting against raw SQL, third-
-- party admin tools, or any path that bypasses the app code.
--
-- The cascading chains *below* student_writings (e.g. body_paragraphs ON
-- DELETE CASCADE → student_writings) are correct and intentional: when a
-- writing is intentionally deleted, its artifacts should go with it.
-- We're only fixing the entry point.
--
-- Safe to run idempotently: DROP CONSTRAINT IF EXISTS handles re-runs
-- without erroring.
-- ============================================================================

BEGIN;

ALTER TABLE student_writings
  DROP CONSTRAINT IF EXISTS student_writings_assignment_id_fkey;

ALTER TABLE student_writings
  ADD CONSTRAINT student_writings_assignment_id_fkey
    FOREIGN KEY (assignment_id)
    REFERENCES assignments(id)
    ON DELETE RESTRICT;

COMMIT;
