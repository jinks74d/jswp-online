-- ---------------------------------------------------------------------------
-- 0054 — Surface student revisions made after a writing is returned
-- ---------------------------------------------------------------------------
--
-- Problem this solves
-- -------------------
-- When a teacher returns a writing for revision, the student can change their
-- work without the teacher having any way to know. Nothing about editing an
-- artifact touches `student_writings`: the `set_updated_at` trigger installed
-- in 0001 is BEFORE UPDATE on each table's OWN row, and nothing propagates up
-- the foreign-key chain. So a student who reworks their Fine-Tune Wording box
-- writes only to `paragraph_forms`, and the teacher's list keeps rendering
-- "Returned 3d ago" forever.
--
-- Why a dedicated column rather than reusing `student_writings.updated_at`
-- -----------------------------------------------------------------------
-- `updated_at` also moves when the TEACHER writes to the row — returning,
-- grading, setting a grade format. Comparing `updated_at > returned_at` would
-- therefore report "the student revised" the moment a teacher graded, which is
-- exactly the false positive that would teach them to ignore the badge.
-- `last_student_edit_at` is only ever written on behalf of the owning student.
--
-- Why triggers rather than an application-level touch
-- --------------------------------------------------
-- The student mutation surface is ~11 server-action modules and dozens of
-- exported functions. A helper called by hand would be one forgotten call away
-- from a signal a teacher has learned to trust but which silently under-reports
-- — worse than no signal. Triggers cover every path, including ones not
-- written yet.
--
-- NEEDS LIVE SUPABASE APPLY.
-- ---------------------------------------------------------------------------

ALTER TABLE student_writings
  ADD COLUMN IF NOT EXISTS last_student_edit_at TIMESTAMPTZ;

COMMENT ON COLUMN student_writings.last_student_edit_at IS
  'When the OWNING STUDENT last changed any artifact belonging to this writing '
  '(set by the touch_* triggers below; never by teacher or admin writes). '
  'Compared against returned_at to show a "Revised" indicator on the teacher''s '
  'submission list. NULL means no student edit has been recorded since 0054.';

-- ---------------------------------------------------------------------------
-- Central bump. SECURITY DEFINER so it can write the parent row from a trigger
-- on a child table, but deliberately guarded by `student_id = auth.uid()` so a
-- teacher, an admin, or a service-role script editing an artifact can never
-- masquerade as student activity. Service-role callers have a NULL auth.uid()
-- and so are no-ops here, which is what we want for seeds and backfills.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_student_writing(p_writing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_writing_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE student_writings
     SET last_student_edit_at = NOW()
   WHERE id = p_writing_id
     AND student_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- One trigger function per depth at which an artifact sits below the writing.
-- Each reads OLD on DELETE and NEW otherwise, so a student removing a CD counts
-- as an edit just as much as adding one.
-- ---------------------------------------------------------------------------

-- Depth 0: the table carries student_writing_id itself.
CREATE OR REPLACE FUNCTION trg_touch_writing_direct()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  PERFORM touch_student_writing(rec.student_writing_id);
  RETURN NULL;
END;
$$;

-- Depth 1: body_paragraphs -> student_writings.
CREATE OR REPLACE FUNCTION trg_touch_writing_via_body_paragraph()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec RECORD;
  v_writing_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  SELECT bp.student_writing_id
    INTO v_writing_id
    FROM body_paragraphs bp
   WHERE bp.id = rec.body_paragraph_id;
  PERFORM touch_student_writing(v_writing_id);
  RETURN NULL;
END;
$$;

-- Depth 2: chunks -> body_paragraphs -> student_writings.
CREATE OR REPLACE FUNCTION trg_touch_writing_via_chunk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec RECORD;
  v_writing_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  SELECT bp.student_writing_id
    INTO v_writing_id
    FROM chunks c
    JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
   WHERE c.id = rec.chunk_id;
  PERFORM touch_student_writing(v_writing_id);
  RETURN NULL;
END;
$$;

-- Depth 1: gathering_cds_sheets -> student_writings.
CREATE OR REPLACE FUNCTION trg_touch_writing_via_gathering_sheet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec RECORD;
  v_writing_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  SELECT g.student_writing_id
    INTO v_writing_id
    FROM gathering_cds_sheets g
   WHERE g.id = rec.gathering_sheet_id;
  PERFORM touch_student_writing(v_writing_id);
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach to every table holding student work.
--
-- Deliberately NOT attached to:
--   * teacher_feedback / rubric_scores — teacher writes, not student edits.
--   * step_progress — written by markStepComplete, which already updates
--     student_writings in the same request; a trigger here would be redundant
--     write amplification on every Continue.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  direct TEXT[] := ARRAY[
    'prompt_decodings', 'text_annotations', 'gathering_cds_sheets',
    'body_paragraphs', 'essay_parts', 'final_drafts'
  ];
  via_bp TEXT[] := ARRAY[
    't_charts', 'chunks', 'shaping_sheets', 'paragraph_forms'
  ];
  via_chunk TEXT[] := ARRAY[
    'concrete_details', 'commentary_items', 'shaping_chunk_outputs'
  ];
  via_sheet TEXT[] := ARRAY['candidate_cds'];
BEGIN
  FOREACH t IN ARRAY direct LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_writing ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_writing AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION trg_touch_writing_direct()', t);
  END LOOP;

  FOREACH t IN ARRAY via_bp LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_writing ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_writing AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION trg_touch_writing_via_body_paragraph()', t);
  END LOOP;

  FOREACH t IN ARRAY via_chunk LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_writing ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_writing AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION trg_touch_writing_via_chunk()', t);
  END LOOP;

  FOREACH t IN ARRAY via_sheet LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_writing ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_writing AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION trg_touch_writing_via_gathering_sheet()', t);
  END LOOP;
END $$;

-- No backfill. Existing rows keep NULL, which reads as "no student edit
-- recorded" — honest, since the information was never captured. The indicator
-- starts working from the first edit after this migration lands.
