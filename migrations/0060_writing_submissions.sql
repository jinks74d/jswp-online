-- ---------------------------------------------------------------------------
-- 0060 — Record every time a student submits a writing, not just the last one
-- ---------------------------------------------------------------------------
--
-- Problem this solves
-- -------------------
-- A teacher looking at the Submissions list cannot tell a student who turned
-- the piece in once from a student who has been returned twice and is on their
-- third attempt. Those are very different conversations, and the second is the
-- one the program exists to have — revision is the pedagogy, not an exception
-- to it.
--
-- Nothing in the schema can answer it today. `student_writings.submitted_at` is
-- a last-write-wins scalar: `submitWriting` overwrites it on every submit, so
-- each return/resubmit cycle destroys the record of the one before. And
-- `draft_number` is not a substitute — despite the column existing since 0001,
-- no server action anywhere in `lib/actions/` ever writes it. Every writing
-- lives at draft_number = 1 and a resubmit reuses the same row.
--
-- Why an event table rather than a counter column
-- -----------------------------------------------
-- A `submission_count SMALLINT` would answer "how many" and nothing else. The
-- dates are the actionable half: "submitted 3 times" tells a teacher there is a
-- problem, "submitted Mar 1, Mar 8, Mar 14" tells her whether the student is
-- iterating or thrashing. Storing `from_status` additionally distinguishes a
-- first submission from a post-return revision, which is the number that makes
-- class-level revision-cycle analytics possible at all.
--
-- Deriving the count from rows also means it cannot drift. There is no second
-- copy to fall out of sync with (cf. CLAUDE.md §14.3).
--
-- Why a trigger rather than an INSERT inside submitWriting()
-- ----------------------------------------------------------
-- Same argument migration 0054 makes for `last_student_edit_at`: an
-- application-level write is one forgotten call away from a signal a teacher
-- has learned to trust but which silently under-reports, which is worse than no
-- signal at all. `submitWriting` happens to be the only writer of
-- status='submitted' today, but a bulk-submit action, an admin override, or a
-- submit-on-due-date job would each have to remember. The trigger covers paths
-- not written yet.
--
-- Append-only by construction
-- ---------------------------
-- SELECT is the only policy on this table. The trigger function is SECURITY
-- DEFINER, so it is the sole writer; no `authenticated` role can forge a
-- submission or erase one to hide a late turn-in. Same shape as `audit_log`
-- (0005), which likewise carries reads-only policies and no write path.
--
-- NEEDS LIVE SUPABASE APPLY.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS writing_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL
                       REFERENCES student_writings(id) ON DELETE CASCADE,

  -- 1 for the first submission, 2 for the first resubmission, and so on.
  -- Derivable via row_number(), but storing it makes the UI a field read and
  -- gives the UNIQUE below something to guard.
  submission_number  SMALLINT NOT NULL CHECK (submission_number > 0),

  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The status the writing was in immediately before this submission.
  -- NULL means there was no prior status to record — see the column comment.
  from_status        jswp_writing_status,

  UNIQUE (student_writing_id, submission_number)
);

COMMENT ON TABLE writing_submissions IS
  'Append-only log of each time a student turned a writing in. One row per '
  'transition into status=''submitted''. Exists because '
  'student_writings.submitted_at is overwritten on every resubmit and so '
  'cannot count cycles. Written only by trg_record_writing_submission(); '
  'there is deliberately no INSERT/UPDATE/DELETE policy. Migration 0060.';

COMMENT ON COLUMN writing_submissions.submission_number IS
  '1-based ordinal within this writing. Assigned by the trigger as MAX+1 and '
  'guarded by the UNIQUE constraint. Monotonic with submitted_at, so ordering '
  'by either gives the same sequence.';

COMMENT ON COLUMN writing_submissions.from_status IS
  'Status immediately before the submission. ''returned'' marks a post-return '
  'revision, which is what class-level revision-cycle analytics counts. NULL '
  'means no prior status is knowable: either the row was backfilled by this '
  'migration (the pre-0060 history was already overwritten) or the writing was '
  'INSERTed already-submitted rather than transitioning into it.';

-- No separate index. The UNIQUE constraint's btree on
-- (student_writing_id, submission_number) already serves both reads we make:
-- the per-writing ordered history, and the per-assignment tally which is
-- driven from the student_writings side.

-- ---------------------------------------------------------------------------
-- 2. Capture.
--
-- SECURITY DEFINER so it can write a table that grants nobody INSERT. Note it
-- deliberately does NOT gate on auth.uid() the way 0054's touch_student_writing
-- does: there the point was to attribute an edit to the student and exclude
-- teacher writes, whereas here the status transition IS the event regardless of
-- who drove it, and service-role paths (seeds, backfills) should record too.
--
-- submitted_at prefers NEW.submitted_at over NOW() so the newest event and the
-- scalar the list already renders agree to the millisecond rather than drifting
-- by the width of the transaction.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_record_writing_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from jswp_writing_status;
BEGIN
  -- No OLD row on INSERT, so there is no prior status to record.
  IF TG_OP = 'UPDATE' THEN
    v_from := OLD.status;
  ELSE
    v_from := NULL;
  END IF;

  -- The aggregate has no GROUP BY, so it yields exactly one row even when the
  -- writing has no submissions yet, and the INSERT always writes one row.
  INSERT INTO writing_submissions (
    student_writing_id, submission_number, submitted_at, from_status
  )
  SELECT
    NEW.id,
    COALESCE(MAX(ws.submission_number), 0) + 1,
    COALESCE(NEW.submitted_at, NOW()),
    v_from
  FROM writing_submissions ws
  WHERE ws.student_writing_id = NEW.id;

  RETURN NULL;
END;
$$;

-- Deliberately NO `REVOKE EXECUTE ... FROM anon, authenticated` here, despite
-- the SECURITY DEFINER. 0057/0059 revoke on `__schema_inventory()` because that
-- function is directly callable and leaks schema when it is. This one is not:
-- PostgreSQL refuses any invocation outside a trigger context with "trigger
-- functions can only be called as triggers", so the REVOKE would defend against
-- nothing — while carrying a real risk of breaking every student submit if
-- EXECUTE turns out to be checked at firing time and not only at CREATE TRIGGER.
-- Zero upside against a catastrophic downside is not a hardening trade worth
-- taking.

-- The WHEN clause is what makes this correct rather than merely frequent:
--   * NEW.status = 'submitted'                — only submissions
--   * OLD.status IS DISTINCT FROM 'submitted' — only TRANSITIONS into it, so a
--     teacher editing a grade on an already-submitted writing adds nothing, and
--     a double-clicked Submit button cannot double-count.
--
-- Plain AFTER UPDATE rather than AFTER UPDATE OF status: the WHEN clause is
-- already the precise filter, and this stays correct if a future BEFORE trigger
-- ever sets NEW.status without status appearing in the caller's SET list.
DROP TRIGGER IF EXISTS record_submission ON student_writings;
CREATE TRIGGER record_submission
  AFTER UPDATE ON student_writings
  FOR EACH ROW
  WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')
  EXECUTE FUNCTION trg_record_writing_submission();

-- The student INSERT policy (0050) checks enrolment and release windows but
-- does not constrain `status`, so a writing can legitimately be created
-- already-submitted. Without this the count would read 0 while the status read
-- 'submitted' — an inconsistency a teacher would notice before we did.
DROP TRIGGER IF EXISTS record_submission_on_insert ON student_writings;
CREATE TRIGGER record_submission_on_insert
  AFTER INSERT ON student_writings
  FOR EACH ROW
  WHEN (NEW.status = 'submitted')
  EXECUTE FUNCTION trg_record_writing_submission();

-- ---------------------------------------------------------------------------
-- 3. RLS — read-only, scoped by the existing helper.
--
-- auth_user_can_read_writing already encodes owner / teacher-of-the-assignment
-- / admin-in-scope and is the same predicate guarding every other per-writing
-- artifact table (CLAUDE.md §6). Re-deriving the scoping here is exactly the
-- legacy mistake §14.4 catalogues.
-- ---------------------------------------------------------------------------

ALTER TABLE writing_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS writing_submissions_read ON writing_submissions;
CREATE POLICY writing_submissions_read ON writing_submissions
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));

-- No INSERT / UPDATE / DELETE policies, for anyone. `anon` gets no policy at
-- all and is therefore denied outright.

-- ---------------------------------------------------------------------------
-- 4. Backfill.
--
-- One row per writing that carries a submitted_at, at that timestamp, with
-- from_status NULL because the prior state was never recorded.
--
-- This UNDERCOUNTS. A writing already through a return/resubmit cycle before
-- 0060 landed shows 1 here when the truth was 2 or more, because submitted_at
-- had already been overwritten and the earlier timestamps do not exist anywhere
-- to recover. Stating the floor honestly beats inventing a number — same call
-- 0054 made when it declined to backfill last_student_edit_at at all.
--
-- Deliberately keyed on submitted_at IS NOT NULL rather than on status: a
-- 'graded' writing with a NULL submitted_at was graded without ever being
-- turned in, and fabricating a submission event for it would corrupt the very
-- analytics this table is meant to feed.
--
-- Idempotent via NOT EXISTS, so re-running this file is safe.
-- ---------------------------------------------------------------------------

INSERT INTO writing_submissions (
  student_writing_id, submission_number, submitted_at, from_status
)
SELECT sw.id, 1, sw.submitted_at, NULL
FROM student_writings sw
WHERE sw.submitted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM writing_submissions ws
    WHERE ws.student_writing_id = sw.id
  );

COMMIT;
