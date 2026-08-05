-- ============================================================================
-- 0049 — Attach a rubric document to an assignment
-- ============================================================================
-- Teachers already have rubrics as real documents: a PDF handed down by the
-- district, a .docx built in Word, an .xlsx grid. Re-typing one into the
-- structured rubric editor is busywork, so an assignment can now carry the
-- original file alongside (or instead of) the structured `rubric` JSONB.
--
-- The two are deliberately independent:
--   * `rubric`            — structured criteria. Drives rubric_scores,
--                           criterion analytics, and the grading panel.
--   * `rubric_file_*`     — the document itself. Read-only reference that
--                           teachers and students can open. Nothing grades
--                           off it.
-- An assignment may have either, both, or neither.
--
-- Storage: the existing `assignment-sources` bucket (0003), under
--   school-{school_id}/teacher-{teacher_id}/rubric/{ts}-{filename}
-- rather than a new bucket. That bucket's RLS already says exactly what a
-- rubric needs — read for authenticated users in the same school, write for
-- teachers/admins in that school — and its policies key off the
-- `school-{uuid}/` path prefix, which the rubric path preserves. A second
-- bucket would be a verbatim copy of those two policies, i.e. the kind of
-- duplicated scoping logic CLAUDE.md §14.4 warns about.
--
-- The folder is keyed to the TEACHER, not the assignment, and that is a
-- security property rather than a filing choice. The client uploads the file
-- and posts the resulting key back through the form, so the key is untrusted
-- input that the server persists and — on a later save — deletes. Binding it
-- to auth.uid() means a forged path can never make one teacher's save sweep
-- another's object. An assignment-keyed folder could not be verified on
-- create, where the row does not exist yet. See lib/rubric-file.ts.
--
-- The bucket's allowed_mime_types is widened below: it was scoped to source
-- texts (pdf / docx / txt / images) and rubrics also arrive as spreadsheets
-- and legacy Office formats.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The three rubric-file columns.
--    Mirrors the source_file_{path,name,mime} triple on assignment_sources:
--    path is the storage key, name is what the teacher uploaded (shown in the
--    UI and used for the download filename), mime drives the icon/handling.
-- ---------------------------------------------------------------------------
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS rubric_file_path TEXT,
  ADD COLUMN IF NOT EXISTS rubric_file_name TEXT,
  ADD COLUMN IF NOT EXISTS rubric_file_mime TEXT;

-- A stored file is meaningless without its display name, and a name without a
-- path points at nothing. Keep the pair in step so readers never have to
-- handle a half-attached rubric. (mime stays free — browsers occasionally
-- report an empty type, and the app falls back to the extension.)
ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_rubric_file_complete;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_rubric_file_complete
  CHECK (
    (rubric_file_path IS NULL AND rubric_file_name IS NULL)
    OR (rubric_file_path IS NOT NULL AND rubric_file_name IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 2. Widen the assignment-sources bucket to the formats rubrics arrive in.
--    Additive — every type allowed by 0003 is still allowed here. Supabase
--    rejects an upload whose Content-Type is absent from this list, so a
--    missing entry surfaces as a confusing "mime type not supported" at pick
--    time; the client resolves the type from the file extension when the
--    browser reports none.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      -- from 0003 — source texts
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
      -- added for rubric documents
      'application/msword',                                                      -- .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       -- .xlsx
      'application/vnd.ms-excel',                                                -- .xls
      'text/csv',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',                                 -- .odt
      'application/vnd.oasis.opendocument.spreadsheet'                           -- .ods
    ]
WHERE id = 'assignment-sources';

COMMIT;
