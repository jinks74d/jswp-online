-- ============================================================================
-- JSWP Online — Initial Schema (0001)
-- ============================================================================
-- Purpose:
--   Mirror the pedagogical artifacts of the Jane Schaffer Academic Writing
--   Program. Every step a teacher leads in the classroom — Decoding the
--   Prompt, Reading & Annotating, Gathering CDs, T-Chart, Shaping Sheet,
--   Paragraph Form — is a first-class table with its own identity.
--
-- Design principles:
--   1. Mode lives ONLY on `assignments`. Sub-artifacts inherit it.
--   2. Multiple drafts per assignment via `student_writings.draft_number`.
--   3. Step ordering is config-driven (see lib/jswp-modes.ts), not encoded
--      in column names like step1..step7.
--   4. Polymorphic `teacher_feedback` so a teacher can leave a comment on
--      any artifact: a single CD, a CM, the T-Chart, the final paragraph.
--   5. Mode-specific extension columns (Argumentation C/CA/R; Narrative
--      WOW fields) live on the T-Chart; they stay NULL when not applicable.
--   6. RLS helper functions defined once. Real policies live in 0002.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE jswp_mode AS ENUM ('expository', 'argumentation', 'literary', 'narrative');

CREATE TYPE jswp_role AS ENUM (
  'super_admin',     -- Anthropic-level full access (Louis Educational Concepts)
  'district_admin',  -- Manages a district
  'school_admin',    -- Manages a school within a district
  'teacher',
  'student'
);

CREATE TYPE jswp_writing_status AS ENUM (
  'draft',           -- not yet started or work in progress, not visible to teacher
  'in_progress',     -- saved at least once
  'submitted',       -- student turned it in
  'returned',        -- teacher sent back for revision
  'graded'           -- final score recorded
);

-- The chunk ratios from the guides.
--   expository / argumentation / narrative = 2+:1
--   literary / response to literature      = 1:2+
--   summary                                 = 3+:0
CREATE TYPE jswp_chunk_ratio AS ENUM ('two_plus_to_one', 'one_to_two_plus', 'three_plus_to_zero');

CREATE TYPE jswp_narrative_kind AS ENUM ('personal', 'fictional');
CREATE TYPE jswp_narrative_subject AS ENUM ('event', 'person', 'place', 'thing');

CREATE TYPE jswp_thesis_frame AS ENUM (
  'open',                  -- "Schools have the greatest impact..."
  'framed_but',            -- "X, but Y."
  'framed_although',       -- "Although X, Y; however, Z."
  'three_pronged'          -- "Schools have the greatest impact by A, B, and C."
);

CREATE TYPE jswp_cm_kind AS ENUM (
  'word',                  -- single-word CMs (Literary stage 2)
  'phrase',                -- elaboration phrases (Literary clouds; argumentation brainstorm)
  'sentence'               -- finished commentary sentences
);

CREATE TYPE jswp_annotation_kind AS ENUM ('cd', 'cm', 'transition', 'note');

-- Polymorphic targets for teacher feedback.
CREATE TYPE jswp_feedback_target AS ENUM (
  'student_writing',
  'prompt_decoding',
  'gathering_sheet',
  'candidate_cd',
  'body_paragraph',
  't_chart',
  'chunk',
  'concrete_detail',
  'commentary_item',
  'shaping_sheet',
  'paragraph_form',
  'essay_parts',
  'final_draft'
);

-- ---------------------------------------------------------------------------
-- 2. Tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE districts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  subdomain       VARCHAR(63) UNIQUE,                     -- 'lacoe' -> lacoe.jswponline.com
  logo_url        TEXT CHECK (logo_url IS NULL OR logo_url ~ '^https?://'),
  primary_color   VARCHAR(7) CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color VARCHAR(7) CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email   TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  level       VARCHAR(20),                               -- 'elementary'|'middle'|'high'|'k12'
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, name)
);

-- user_profiles extends Supabase's built-in auth.users.
-- Auth (passwords, OAuth) lives in auth.users; PII and role live here.
CREATE TABLE user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id         UUID NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  school_id           UUID REFERENCES schools(id) ON DELETE SET NULL,  -- NULL ok for super/district admins
  role                jswp_role NOT NULL,
  first_name          VARCHAR(100),
  last_name           VARCHAR(100),
  email               VARCHAR(255) UNIQUE,
  student_id_external VARCHAR(64),                       -- district SIS id (Clever, ClassLink, manual)
  grade_level         VARCHAR(10),                       -- 'K', '3', '11' etc. (students)
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role = 'super_admin' OR district_id IS NOT NULL),
  CHECK (role IN ('super_admin','district_admin') OR school_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 3. Class structure (Subject -> Class -> Period)
-- ---------------------------------------------------------------------------

CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,                     -- "English", "Social Studies"
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,                      -- "English I Honors", "AP Lang"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, name)
);

CREATE TABLE class_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  period_label  VARCHAR(50) NOT NULL,                    -- '1', '2A', 'Morning', 'Block 3'
  academic_year VARCHAR(20),                             -- '2025-2026'
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, period_label, academic_year)
);

CREATE TABLE class_teacher_assignments (
  class_period_id UUID NOT NULL REFERENCES class_periods(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by     UUID REFERENCES user_profiles(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_period_id, teacher_id)
);

CREATE TABLE class_student_enrollments (
  class_period_id UUID NOT NULL REFERENCES class_periods(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unenrolled_at   TIMESTAMPTZ,
  PRIMARY KEY (class_period_id, student_id)
);

-- ---------------------------------------------------------------------------
-- 4. Assignments
-- ---------------------------------------------------------------------------
-- An assignment is a teacher-authored prompt + workflow configuration.
-- Mode lives here only. Body paragraph count, chunk ratio, counterargument
-- toggle, and source text are all set on the assignment so students inherit
-- the right structure for their writing.

CREATE TABLE assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id            UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  class_period_id       UUID REFERENCES class_periods(id) ON DELETE SET NULL,
  district_id           UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  title                 VARCHAR(255) NOT NULL,
  prompt                TEXT NOT NULL,
  mode                  jswp_mode NOT NULL,

  -- Pedagogical structure
  is_essay              BOOLEAN NOT NULL DEFAULT FALSE,
  num_body_paragraphs   SMALLINT NOT NULL DEFAULT 1
                          CHECK (num_body_paragraphs BETWEEN 1 AND 10),
  default_chunk_ratio   jswp_chunk_ratio NOT NULL,
  default_chunks_per_bp SMALLINT NOT NULL DEFAULT 1
                          CHECK (default_chunks_per_bp BETWEEN 1 AND 5),
  has_counterargument   BOOLEAN NOT NULL DEFAULT FALSE,  -- argumentation only

  -- Optional source text (article, poem, story) students annotate
  source_text     TEXT,
  source_title    TEXT,
  source_author   TEXT,
  source_citation TEXT,
  source_url      TEXT,

  -- Workflow
  due_at                TIMESTAMPTZ,
  allow_multiple_drafts BOOLEAN NOT NULL DEFAULT TRUE,
  max_drafts            SMALLINT,                        -- NULL = unlimited
  released_at           TIMESTAMPTZ,                     -- visible to students after this
  closed_at             TIMESTAMPTZ,                     -- no further drafts after this

  -- Inline rubric definition; mode-specific shape (see lib/jswp-rubrics.ts)
  rubric                JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sanity: argumentation-only flag must not be set on other modes
  CHECK (NOT has_counterargument OR mode = 'argumentation'),
  -- Literary should default to 1:2+, others to 2+:1
  CHECK (
    (mode = 'literary' AND default_chunk_ratio = 'one_to_two_plus')
    OR (mode <> 'literary')
  )
);

-- ---------------------------------------------------------------------------
-- 5. Student Writings (one per draft attempt)
-- ---------------------------------------------------------------------------
-- A student gets one student_writings row per draft. Draft 1 is the first
-- attempt; submitting a revision creates draft 2 (carrying or copying
-- artifacts forward is application logic).

CREATE TABLE student_writings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  draft_number    SMALLINT NOT NULL DEFAULT 1 CHECK (draft_number > 0),
  status          jswp_writing_status NOT NULL DEFAULT 'draft',

  -- Which step in the mode's flow is the student currently on?
  -- Stored as a config key like 'expository.gather_cds'.
  current_step    VARCHAR(100),

  -- Per-writing override of the assignment's default ratio (rare but allowed)
  chunk_ratio     jswp_chunk_ratio NOT NULL,

  submitted_at    TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  graded_at       TIMESTAMPTZ,
  total_score     NUMERIC(5,2),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (assignment_id, student_id, draft_number)
);

-- ---------------------------------------------------------------------------
-- 6. Step 1 — Decoded Prompt
-- ---------------------------------------------------------------------------
-- The guide is explicit: students decode the prompt before writing. They
-- identify (a) what the prompt asks them to do, (b) the form (paragraph,
-- short answer, essay), (c) the ratio, and (d) key verbs / focus terms.

CREATE TABLE prompt_decodings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL UNIQUE REFERENCES student_writings(id) ON DELETE CASCADE,
  task               TEXT,
  form               VARCHAR(40),                        -- 'short_answer'|'paragraph'|'essay'
  ratio_identified   jswp_chunk_ratio,
  key_verbs          TEXT[],                             -- ['discuss','argue','analyze']
  focus_terms        TEXT[],
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. Step 2 — Reading & Annotating the Source Text
-- ---------------------------------------------------------------------------
-- Students color-code annotations directly on the source text (red = CD,
-- green = CM). Stored as character ranges so the source text on
-- assignments stays canonical.

CREATE TABLE text_annotations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  range_start        INT NOT NULL CHECK (range_start >= 0),
  range_end          INT NOT NULL,
  selected_text      TEXT NOT NULL,                      -- denormalized for display
  kind               jswp_annotation_kind NOT NULL,
  note               TEXT,                               -- student's marginal note
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (range_end > range_start)
);

-- ---------------------------------------------------------------------------
-- 8. Step 3 — Gathering CDs (the brainstorm sheet)
-- ---------------------------------------------------------------------------
-- One sheet per body paragraph. Holds 4-12+ candidate CDs. The student
-- highlights / orders 2+ that get promoted to a chunk in the T-Chart.

CREATE TABLE gathering_cds_sheets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id      UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  body_paragraph_position SMALLINT NOT NULL CHECK (body_paragraph_position > 0),
  task_portion            TEXT,                          -- portion of prompt this BP addresses
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_writing_id, body_paragraph_position)
);

CREATE TABLE candidate_cds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_sheet_id UUID NOT NULL REFERENCES gathering_cds_sheets(id) ON DELETE CASCADE,
  position           SMALLINT NOT NULL,
  text               TEXT NOT NULL,
  is_selected        BOOLEAN NOT NULL DEFAULT FALSE,
  selection_order    SMALLINT,                           -- 1, 2, 3 if promoted to chunk

  -- Argumentation-specific: pro/con tagging during TS Development
  argumentation_side VARCHAR(10) CHECK (argumentation_side IN ('pro','con','neutral') OR argumentation_side IS NULL),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gathering_sheet_id, position)
);

-- ---------------------------------------------------------------------------
-- 9. Body Paragraphs
-- ---------------------------------------------------------------------------

CREATE TABLE body_paragraphs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id  UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  position            SMALLINT NOT NULL CHECK (position > 0),
  label               VARCHAR(255),                      -- "BP1 - Student's Perspective"
  num_chunks          SMALLINT NOT NULL DEFAULT 1
                        CHECK (num_chunks BETWEEN 1 AND 5),
  has_counterargument BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_writing_id, position)
);

-- ---------------------------------------------------------------------------
-- 10. Step 4 — T-Chart (per body paragraph)
-- ---------------------------------------------------------------------------
-- The T-Chart is where TS / CDs / CMs / CS first appear together as a unit.
-- Mode-specific extension columns live here:
--   * Argumentation: concession, counterargument, refutation
--   * Narrative: WOW-style brainstorm fields (when/where/who/what/dialogue/feeling/thinking)

CREATE TABLE t_charts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_paragraph_id        UUID NOT NULL UNIQUE REFERENCES body_paragraphs(id) ON DELETE CASCADE,

  working_topic_sentence   TEXT,                         -- first draft TS
  revised_topic_sentence   TEXT,                         -- "moves and improves"
  concluding_sentence      TEXT,

  -- Argumentation extensions
  concession               TEXT,
  counterargument          TEXT,
  refutation               TEXT,

  -- Narrative extensions (Discovery + WOW)
  narrative_kind           jswp_narrative_kind,
  narrative_subject        jswp_narrative_subject,
  narrative_key_word       TEXT,
  narrative_general_ideas  TEXT[],
  narrative_concrete_example TEXT,
  narrative_when           TEXT,
  narrative_where          TEXT,
  narrative_who            TEXT,
  narrative_what_happened  TEXT,
  narrative_dialogue       TEXT,
  narrative_feeling        TEXT,
  narrative_thinking       TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 11. Chunks (within a body paragraph)
-- ---------------------------------------------------------------------------

CREATE TABLE chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_paragraph_id UUID NOT NULL REFERENCES body_paragraphs(id) ON DELETE CASCADE,
  position          SMALLINT NOT NULL CHECK (position > 0),
  ratio             jswp_chunk_ratio NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (body_paragraph_id, position)
);

-- The "promoted" CDs that live inside a chunk (vs. candidate_cds, which
-- are the brainstorm pool). Each CD becomes one sentence in the paragraph.
CREATE TABLE concrete_details (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id             UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  position             SMALLINT NOT NULL,
  text                 TEXT NOT NULL,

  -- Embedding Quotations (Argumentation/Expository/Literary)
  is_quotation         BOOLEAN NOT NULL DEFAULT FALSE,
  transitional_lead_in TEXT,                             -- "TLCD" — phrase that introduces the quote
  source_citation      TEXT,                             -- "(Bateman 108)"

  -- Trace-back to brainstorm
  candidate_cd_id      UUID REFERENCES candidate_cds(id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chunk_id, position)
);

-- Commentary items range from single words (Literary) to phrases (Literary
-- "clouds" / Argumentation brainstorm) to finished sentences. The kind
-- column distinguishes them.
CREATE TABLE commentary_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id                 UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  parent_cd_id             UUID REFERENCES concrete_details(id) ON DELETE SET NULL,
  position                 SMALLINT NOT NULL,
  text                     TEXT NOT NULL,
  kind                     jswp_cm_kind NOT NULL,

  -- Pick-n-Stitch tracking — has this item been used in a final sentence?
  -- ("Once you use it, you lose it.")
  used_in_topic_sentence    BOOLEAN NOT NULL DEFAULT FALSE,
  used_in_cm_sentence       BOOLEAN NOT NULL DEFAULT FALSE,
  used_in_concluding_sentence BOOLEAN NOT NULL DEFAULT FALSE,

  -- Literary-specific: the "best" word picked for the TS or chunk
  is_best_word_for_ts      BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_word_for_chunk   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commentary_items_chunk_position ON commentary_items(chunk_id, position);

-- ---------------------------------------------------------------------------
-- 12. Step 5 — Shaping Sheet (per body paragraph)
-- ---------------------------------------------------------------------------
-- Where the T-Chart is "moved and improved" into woven sentences. Tracks
-- which of Dr. Louis's 15 Rules of Grammar were applied (rules_applied
-- holds rule keys defined in lib/jswp-grammar-rules.ts).

CREATE TABLE shaping_sheets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_paragraph_id         UUID NOT NULL UNIQUE REFERENCES body_paragraphs(id) ON DELETE CASCADE,

  final_topic_sentence      TEXT,
  final_concession          TEXT,
  final_counterargument     TEXT,
  final_refutation          TEXT,
  final_concluding_sentence TEXT,

  rules_applied             TEXT[],                      -- ['rule_3','rule_7']
  notes                     TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The woven CD/CM sentences for each chunk on the shaping sheet.
CREATE TABLE shaping_chunk_outputs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shaping_sheet_id  UUID NOT NULL REFERENCES shaping_sheets(id) ON DELETE CASCADE,
  chunk_id          UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  cd_sentences      TEXT[],                              -- ordered final CD sentences
  cm_sentences      TEXT[],                              -- ordered final CM sentences
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shaping_sheet_id, chunk_id)
);

-- ---------------------------------------------------------------------------
-- 13. Essay Parts (when assignments.is_essay = TRUE)
-- ---------------------------------------------------------------------------

CREATE TABLE essay_parts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id     UUID NOT NULL UNIQUE REFERENCES student_writings(id) ON DELETE CASCADE,

  thesis_text            TEXT,
  thesis_frame           jswp_thesis_frame,

  introduction_text      TEXT,
  introduction_hook_kind VARCHAR(50),                    -- 'anecdote'|'rhetorical_question'|'startling_fact'|'dialogue'|'famous_quote'|'internal_monologue'

  conclusion_text        TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 14. Final Step — Paragraph Form / Final Draft
-- ---------------------------------------------------------------------------
-- Per-BP paragraph form (single-paragraph assignments) and per-writing
-- final draft (essays). They co-exist; an essay has both.

CREATE TABLE paragraph_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_paragraph_id UUID NOT NULL UNIQUE REFERENCES body_paragraphs(id) ON DELETE CASCADE,
  final_text        TEXT NOT NULL,
  word_count        INT,                                 -- maintained by trigger
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE final_drafts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL UNIQUE REFERENCES student_writings(id) ON DELETE CASCADE,
  title              VARCHAR(255),                       -- creative title at end of process
  full_text          TEXT NOT NULL,
  word_count         INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 15. Step Progress Tracker
-- ---------------------------------------------------------------------------
-- Decoupled from schema: step_key is whatever lib/jswp-modes.ts says.
-- This is the single source of truth for "where is the student in the flow?"

CREATE TABLE step_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  step_key           VARCHAR(100) NOT NULL,              -- 'expository.gather_cds'
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_writing_id, step_key)
);

-- ---------------------------------------------------------------------------
-- 16. Polymorphic Teacher Feedback
-- ---------------------------------------------------------------------------
-- Replaces step1..step7 JSONB. A teacher can attach feedback to any
-- artifact. Always scoped to a student_writing_id for fast retrieval.

CREATE TABLE teacher_feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_writing_id UUID NOT NULL REFERENCES student_writings(id) ON DELETE CASCADE,
  teacher_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  target_kind        jswp_feedback_target NOT NULL,
  target_id          UUID NOT NULL,                      -- references the relevant table by target_kind
  body               TEXT NOT NULL,
  rubric_score       NUMERIC(5,2),
  is_resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 17. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_user_profiles_district ON user_profiles(district_id);
CREATE INDEX idx_user_profiles_school   ON user_profiles(school_id);
CREATE INDEX idx_user_profiles_role     ON user_profiles(role);

CREATE INDEX idx_schools_district       ON schools(district_id);

CREATE INDEX idx_subjects_school        ON subjects(school_id);
CREATE INDEX idx_classes_subject        ON classes(subject_id);
CREATE INDEX idx_classes_school         ON classes(school_id);
CREATE INDEX idx_class_periods_class    ON class_periods(class_id);
CREATE INDEX idx_class_periods_school   ON class_periods(school_id);

CREATE INDEX idx_assignments_teacher       ON assignments(teacher_id);
CREATE INDEX idx_assignments_class_period  ON assignments(class_period_id);
CREATE INDEX idx_assignments_district      ON assignments(district_id);
CREATE INDEX idx_assignments_school        ON assignments(school_id);
CREATE INDEX idx_assignments_due           ON assignments(due_at);
CREATE INDEX idx_assignments_mode          ON assignments(mode);

CREATE INDEX idx_writings_assignment ON student_writings(assignment_id);
CREATE INDEX idx_writings_student    ON student_writings(student_id);
CREATE INDEX idx_writings_status     ON student_writings(status);

CREATE INDEX idx_text_annotations_writing ON text_annotations(student_writing_id);
CREATE INDEX idx_gathering_sheets_writing ON gathering_cds_sheets(student_writing_id);
CREATE INDEX idx_candidate_cds_sheet      ON candidate_cds(gathering_sheet_id);

CREATE INDEX idx_body_paragraphs_writing ON body_paragraphs(student_writing_id);
CREATE INDEX idx_chunks_bp               ON chunks(body_paragraph_id);
CREATE INDEX idx_cds_chunk               ON concrete_details(chunk_id);
CREATE INDEX idx_cms_chunk               ON commentary_items(chunk_id);
CREATE INDEX idx_cms_parent_cd           ON commentary_items(parent_cd_id);

CREATE INDEX idx_step_progress_writing   ON step_progress(student_writing_id);

CREATE INDEX idx_teacher_feedback_writing ON teacher_feedback(student_writing_id);
CREATE INDEX idx_teacher_feedback_target  ON teacher_feedback(target_kind, target_id);
CREATE INDEX idx_teacher_feedback_teacher ON teacher_feedback(teacher_id);

-- ---------------------------------------------------------------------------
-- 18. updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      r.table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 19. Word-count triggers for paragraph_forms / final_drafts
-- ---------------------------------------------------------------------------

-- One trigger function per table: Postgres binds NEW.<col> against the
-- table rowtype at execution, so a shared function referencing both
-- final_text and full_text would throw "record 'new' has no field …"
-- on whichever column the firing table lacks.
-- NULLIF(trim(...), '') makes an empty/whitespace-only body produce
-- word_count = 0 (regexp_split_to_array on '' returns {''}, length 1).

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

-- ---------------------------------------------------------------------------
-- 20. RLS helper functions (policies live in 0002_rls_policies.sql)
-- ---------------------------------------------------------------------------
-- These are SECURITY DEFINER so they don't recurse through RLS when checking
-- the current user's role/scope. Defined once here so every policy uses
-- the same source of truth — eliminates the kind of RLS churn the legacy
-- repo accumulated.

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS jswp_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_district_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT district_id FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT school_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Convenience: is the calling user a teacher of the given class period?
CREATE OR REPLACE FUNCTION auth_user_teaches_class_period(cp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_teacher_assignments
    WHERE class_period_id = cp_id
      AND teacher_id = auth.uid()
  );
$$;

-- Convenience: is the calling user a student enrolled in the given class period?
CREATE OR REPLACE FUNCTION auth_user_enrolled_in_class_period(cp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_student_enrollments
    WHERE class_period_id = cp_id
      AND student_id = auth.uid()
      AND unenrolled_at IS NULL
  );
$$;

COMMIT;
