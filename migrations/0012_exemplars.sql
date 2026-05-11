-- ============================================================================
-- 0012 — Exemplars (Phase 6.1)
-- ============================================================================
-- Teacher-authored reference essays/paragraphs that students can view as
-- model writing. Per-teacher private in v1: only the author can edit; the
-- author's students see published exemplars matching their writing's mode.
-- Sharing across teachers, per-step tagging, color-coded overlays, and
-- structured-mirror-of-student_writings are all deferred to 6.2+.
--
-- Storage: flat full_text TEXT. Typical exemplar is <20KB. Structured
-- exemplar tables (body_paragraphs, t_charts, etc.) would be the natural
-- evolution if "side-by-side exemplar vs student draft" ever lands.
--
-- created_by ON DELETE SET NULL preserves the library after a teacher
-- leaves. Matches signup_requests.decided_by (0006). The exemplar
-- becomes anonymous but readable; admins retain moderation access.
-- ============================================================================

BEGIN;

CREATE TABLE exemplars (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id   UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  mode          jswp_mode NOT NULL,
  full_text     TEXT NOT NULL,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exemplars_created_by
  ON exemplars(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX idx_exemplars_school_mode_published
  ON exemplars(school_id, mode) WHERE is_published = TRUE;

-- 0001's bulk DO block creates set_updated_at on every table with an
-- updated_at column at migration time. New tables added later need it
-- attached explicitly (same as 0011_rubric_scores).
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON exemplars
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE exemplars ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS helper: student-side read check
-- ---------------------------------------------------------------------------
-- Pulled out so the policy stays small and there's one place to optimize
-- later (e.g., a materialized view of "student → teacher_ids" if RLS perf
-- becomes an issue at scale). Matches the auth_user_*() convention.
CREATE OR REPLACE FUNCTION auth_user_student_can_read_exemplar(creator_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_student_enrollments cse
    JOIN class_teacher_assignments cta
      ON cta.class_period_id = cse.class_period_id
    WHERE cse.student_id = auth.uid()
      AND cse.unenrolled_at IS NULL
      AND cta.teacher_id = creator_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Owner full CRUD on their own exemplars. The role check in WITH CHECK
-- keeps students from authoring even if their UUID somehow matched.
CREATE POLICY exemplars_owner_all ON exemplars
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND auth_user_role() IN (
      'teacher', 'school_admin', 'district_admin', 'super_admin'
    )
  );

-- Students read published exemplars whose author teaches one of their
-- currently-enrolled class periods. Mode filtering happens in the query
-- layer (cheaper; mode isn't sensitive).
CREATE POLICY exemplars_student_read ON exemplars
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND auth_user_role() = 'student'
    AND auth_user_student_can_read_exemplar(created_by)
  );

-- School/district/super admins read in scope for moderation. No write —
-- only the author can edit/delete in v1.
CREATE POLICY exemplars_admin_read ON exemplars
  FOR SELECT TO authenticated
  USING (auth_user_is_admin_for_school(school_id));

COMMIT;
