-- ============================================================================
-- 0040 — Multiple sources per assignment (Phase A: data model + backfill)
-- ============================================================================
-- Assignments carried exactly ONE source, stored as source_* columns on
-- `assignments` (0001 + 0025). Teachers need to attach several primary/
-- secondary sources. This introduces a child table `assignment_sources`
-- (one row per source) and gives `text_annotations` a `source_id` so a
-- student's character-offset annotations know WHICH source they belong to.
--
-- Transition strategy (agreed with product): keep the legacy
-- assignments.source_* columns in place for now; backfill one
-- assignment_sources row per assignment that currently has a source, and
-- point every existing annotation at that migrated row. A later migration
-- drops the legacy columns once all readers are cut over.
--
-- Offset invariant (see docs/SOURCE_TEXT_ARCHITECTURE.md): each source keeps
-- its own source_text substrate; annotations remain character offsets, now
-- scoped to a single source via source_id.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. assignment_sources — one row per source attached to an assignment.
--    Mirrors the 10 legacy source_* columns, plus ordering (position) and a
--    primary/secondary classification.
-- ---------------------------------------------------------------------------
CREATE TABLE assignment_sources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  position           SMALLINT NOT NULL CHECK (position > 0),
  kind               TEXT NOT NULL DEFAULT 'primary'
                       CHECK (kind IN ('primary', 'secondary')),

  source_text        TEXT,
  source_title       TEXT,
  source_author      TEXT,
  source_citation    TEXT,
  source_url         TEXT,
  source_html        TEXT,
  source_render_mode TEXT
                       CHECK (source_render_mode IS NULL
                              OR source_render_mode IN ('pdf', 'rich', 'plain')),
  source_file_path   TEXT,
  source_file_name   TEXT,
  source_file_mime   TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (assignment_id, position)
);

CREATE INDEX assignment_sources_assignment_idx
  ON assignment_sources (assignment_id);

-- ---------------------------------------------------------------------------
-- 2. text_annotations.source_id — which source the offsets index into.
--    Nullable: legacy rows are backfilled below; going forward the app
--    always sets it. ON DELETE CASCADE so removing a (pre-publish) source
--    removes its annotations.
-- ---------------------------------------------------------------------------
ALTER TABLE text_annotations
  ADD COLUMN source_id UUID REFERENCES assignment_sources(id) ON DELETE CASCADE;

CREATE INDEX text_annotations_source_idx
  ON text_annotations (source_id);

-- ---------------------------------------------------------------------------
-- 3. RLS: assignment_sources ride the parent assignment's visibility.
--    Two SECURITY DEFINER helpers keep the scoping logic in one place
--    (mirrors the assignments policies in 0002: teacher-owner, co-teacher,
--    in-scope admin, and — for read only — an enrolled student once the
--    assignment is released).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_can_read_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = a_id
      AND (
        a.teacher_id = auth.uid()
        OR (a.class_period_id IS NOT NULL
            AND auth_user_teaches_class_period(a.class_period_id))
        OR auth_user_is_admin_for_school(a.school_id)
        OR (a.class_period_id IS NOT NULL
            AND auth_user_enrolled_in_class_period(a.class_period_id)
            AND (a.released_at IS NULL OR a.released_at <= NOW()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_can_write_assignment(a_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = a_id
      AND (
        a.teacher_id = auth.uid()
        OR (a.class_period_id IS NOT NULL
            AND auth_user_teaches_class_period(a.class_period_id))
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

ALTER TABLE assignment_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignment_sources_read ON assignment_sources
  FOR SELECT TO authenticated
  USING (auth_user_can_read_assignment(assignment_id));

CREATE POLICY assignment_sources_write ON assignment_sources
  FOR ALL TO authenticated
  USING (auth_user_can_write_assignment(assignment_id))
  WITH CHECK (auth_user_can_write_assignment(assignment_id));

-- ---------------------------------------------------------------------------
-- 4. Backfill: one assignment_sources row per assignment that has any source
--    signal today (text, rich html, or an uploaded file). Idempotent — the
--    NOT EXISTS guard means a re-run inserts nothing.
-- ---------------------------------------------------------------------------
INSERT INTO assignment_sources (
  assignment_id, position, kind,
  source_text, source_title, source_author, source_citation, source_url,
  source_html, source_render_mode,
  source_file_path, source_file_name, source_file_mime
)
SELECT
  a.id, 1, 'primary',
  a.source_text, a.source_title, a.source_author, a.source_citation, a.source_url,
  a.source_html, a.source_render_mode,
  a.source_file_path, a.source_file_name, a.source_file_mime
FROM assignments a
WHERE (
    a.source_text IS NOT NULL
    OR a.source_html IS NOT NULL
    OR a.source_file_path IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM assignment_sources s WHERE s.assignment_id = a.id
  );

-- ---------------------------------------------------------------------------
-- 5. Backfill: point existing annotations at their assignment's migrated
--    (position 1) source. Only rows that don't already carry a source_id.
-- ---------------------------------------------------------------------------
UPDATE text_annotations ta
  SET source_id = s.id
  FROM student_writings sw
  JOIN assignments a ON a.id = sw.assignment_id
  JOIN assignment_sources s
    ON s.assignment_id = a.id AND s.position = 1
  WHERE ta.student_writing_id = sw.id
    AND ta.source_id IS NULL;

COMMIT;
