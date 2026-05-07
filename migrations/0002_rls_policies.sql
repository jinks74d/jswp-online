-- ============================================================================
-- JSWP Online — RLS Policies (0002)
-- ============================================================================
-- Locks down every table created in 0001. Policies follow one consistent
-- pattern using the SECURITY DEFINER helpers from 0001:
--
--   * Super admins: full access everywhere.
--   * District admins: full access within their district.
--   * School admins: full access within their school.
--   * Teachers: full access to their assignments + class periods + students.
--   * Students: full access to their OWN writings; read access to assignments
--     in periods they're enrolled in (after release).
--
-- Design rules:
--   1. RLS is the source of truth. Application checks are defense-in-depth.
--   2. Every helper used inside a policy is SECURITY DEFINER (defined in 0001
--      and below) so RLS doesn't recurse on itself.
--   3. INSERT policies restrict NEW rows. SELECT/UPDATE/DELETE restrict by
--      ownership/scope. We use FOR ALL where it cleanly applies, FOR <verb>
--      where the rules differ across operations.
--   4. We never trust client-supplied IDs in policies — every check resolves
--      back to auth.uid() via a helper.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Additional helper functions
-- ---------------------------------------------------------------------------

-- Is the calling user an admin (super, district, school) in scope of the
-- given district / school? Centralizes the "admin in scope" check so we
-- don't repeat the EXISTS subquery in dozens of policies.

CREATE OR REPLACE FUNCTION auth_user_is_admin_for_district(d_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND active = TRUE
      AND (
        role = 'super_admin'
        OR (role = 'district_admin' AND district_id = d_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_is_admin_for_school(s_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN schools s ON s.id = s_id
    WHERE up.id = auth.uid()
      AND up.active = TRUE
      AND (
        up.role = 'super_admin'
        OR (up.role = 'district_admin' AND up.district_id = s.district_id)
        OR (up.role = 'school_admin'  AND up.school_id  = s_id)
      )
  );
$$;

-- Can the calling user read this student writing? True if:
--   * they ARE the student, OR
--   * they teach the class period the assignment belongs to, OR
--   * they're an admin in scope.
-- Used by all the per-writing artifact tables to keep policies one-line.

CREATE OR REPLACE FUNCTION auth_user_can_read_writing(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_writings sw
    JOIN assignments a ON a.id = sw.assignment_id
    WHERE sw.id = w_id
      AND (
        sw.student_id = auth.uid()
        OR a.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_teacher_assignments cta
          WHERE cta.class_period_id = a.class_period_id
            AND cta.teacher_id = auth.uid()
        )
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

-- Can the calling user WRITE this student writing? Stricter than read:
--   * they ARE the student (and writing is editable), OR
--   * they're the assigning teacher (for status changes / feedback), OR
--   * they're an admin in scope.

CREATE OR REPLACE FUNCTION auth_user_can_write_writing(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_writings sw
    JOIN assignments a ON a.id = sw.assignment_id
    WHERE sw.id = w_id
      AND (
        (sw.student_id = auth.uid() AND sw.status IN ('draft','in_progress','returned'))
        OR a.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_teacher_assignments cta
          WHERE cta.class_period_id = a.class_period_id
            AND cta.teacher_id = auth.uid()
        )
        OR auth_user_is_admin_for_school(a.school_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------

ALTER TABLE districts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_periods              ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_student_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_writings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_decodings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_annotations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gathering_cds_sheets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_cds              ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_paragraphs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_charts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE concrete_details           ENABLE ROW LEVEL SECURITY;
ALTER TABLE commentary_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shaping_sheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shaping_chunk_outputs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_parts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE paragraph_forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_drafts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_progress              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_feedback           ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- TENANCY: districts, schools, user_profiles
-- ===========================================================================

-- ---- districts ----------------------------------------------------------

-- Anyone authenticated can read the district they belong to (so the UI can
-- render branding). Public anon access is denied.
CREATE POLICY districts_read_self ON districts
  FOR SELECT TO authenticated
  USING (id = auth_user_district_id() OR auth_user_role() = 'super_admin');

-- Super admins manage all districts. District admins can update their own.
CREATE POLICY districts_super_admin_all ON districts
  FOR ALL TO authenticated
  USING (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

CREATE POLICY districts_district_admin_update ON districts
  FOR UPDATE TO authenticated
  USING (id = auth_user_district_id() AND auth_user_role() = 'district_admin')
  WITH CHECK (id = auth_user_district_id() AND auth_user_role() = 'district_admin');

-- ---- schools ------------------------------------------------------------

CREATE POLICY schools_read_in_district ON schools
  FOR SELECT TO authenticated
  USING (
    district_id = auth_user_district_id()
    OR auth_user_role() = 'super_admin'
  );

CREATE POLICY schools_admin_manage ON schools
  FOR ALL TO authenticated
  USING (auth_user_is_admin_for_district(district_id))
  WITH CHECK (auth_user_is_admin_for_district(district_id));

-- ---- user_profiles ------------------------------------------------------
-- Self-access: every user can read+update their own profile.

CREATE POLICY user_profiles_read_self ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY user_profiles_update_self ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Users can't change their own role or district. Admins do that.
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    AND district_id = (SELECT district_id FROM user_profiles WHERE id = auth.uid())
  );

-- Same-school visibility: teachers see other teachers and students in their
-- school. Students see teachers in their school + themselves.
CREATE POLICY user_profiles_read_same_school ON user_profiles
  FOR SELECT TO authenticated
  USING (
    school_id IS NOT NULL
    AND school_id = auth_user_school_id()
  );

-- Admin management: super admins everywhere; district admins in their
-- district; school admins in their school for non-admin roles.
CREATE POLICY user_profiles_super_admin_all ON user_profiles
  FOR ALL TO authenticated
  USING (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

CREATE POLICY user_profiles_district_admin_manage ON user_profiles
  FOR ALL TO authenticated
  USING (
    auth_user_role() = 'district_admin'
    AND district_id = auth_user_district_id()
  )
  WITH CHECK (
    auth_user_role() = 'district_admin'
    AND district_id = auth_user_district_id()
  );

CREATE POLICY user_profiles_school_admin_manage ON user_profiles
  FOR ALL TO authenticated
  USING (
    auth_user_role() = 'school_admin'
    AND school_id = auth_user_school_id()
    AND role IN ('teacher', 'student')         -- school admins can't escalate roles
  )
  WITH CHECK (
    auth_user_role() = 'school_admin'
    AND school_id = auth_user_school_id()
    AND role IN ('teacher', 'student')
  );

-- ===========================================================================
-- CLASS STRUCTURE: subjects, classes, class_periods, assignments
-- ===========================================================================

-- ---- subjects -----------------------------------------------------------

CREATE POLICY subjects_read_in_school ON subjects
  FOR SELECT TO authenticated
  USING (school_id = auth_user_school_id() OR auth_user_role() = 'super_admin');

CREATE POLICY subjects_admin_manage ON subjects
  FOR ALL TO authenticated
  USING (auth_user_is_admin_for_school(school_id))
  WITH CHECK (auth_user_is_admin_for_school(school_id));

-- ---- classes ------------------------------------------------------------

CREATE POLICY classes_read_in_school ON classes
  FOR SELECT TO authenticated
  USING (school_id = auth_user_school_id() OR auth_user_role() = 'super_admin');

CREATE POLICY classes_admin_manage ON classes
  FOR ALL TO authenticated
  USING (auth_user_is_admin_for_school(school_id))
  WITH CHECK (auth_user_is_admin_for_school(school_id));

-- ---- class_periods ------------------------------------------------------

CREATE POLICY class_periods_read_in_school ON class_periods
  FOR SELECT TO authenticated
  USING (school_id = auth_user_school_id() OR auth_user_role() = 'super_admin');

CREATE POLICY class_periods_admin_manage ON class_periods
  FOR ALL TO authenticated
  USING (auth_user_is_admin_for_school(school_id))
  WITH CHECK (auth_user_is_admin_for_school(school_id));

-- Teachers can update period metadata for periods they teach (light edits
-- like academic_year corrections). They can't INSERT/DELETE periods.
CREATE POLICY class_periods_teacher_update ON class_periods
  FOR UPDATE TO authenticated
  USING (auth_user_teaches_class_period(id))
  WITH CHECK (auth_user_teaches_class_period(id));

-- ---- class_teacher_assignments -----------------------------------------

CREATE POLICY class_teacher_assignments_read ON class_teacher_assignments
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR auth_user_role() IN ('super_admin','district_admin','school_admin')
  );

CREATE POLICY class_teacher_assignments_admin_manage ON class_teacher_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_periods cp
      WHERE cp.id = class_teacher_assignments.class_period_id
        AND auth_user_is_admin_for_school(cp.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_periods cp
      WHERE cp.id = class_teacher_assignments.class_period_id
        AND auth_user_is_admin_for_school(cp.school_id)
    )
  );

-- ---- class_student_enrollments -----------------------------------------

CREATE POLICY class_student_enrollments_student_read_self ON class_student_enrollments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY class_student_enrollments_teacher_read ON class_student_enrollments
  FOR SELECT TO authenticated
  USING (auth_user_teaches_class_period(class_period_id));

CREATE POLICY class_student_enrollments_admin_manage ON class_student_enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_periods cp
      WHERE cp.id = class_student_enrollments.class_period_id
        AND auth_user_is_admin_for_school(cp.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_periods cp
      WHERE cp.id = class_student_enrollments.class_period_id
        AND auth_user_is_admin_for_school(cp.school_id)
    )
  );

-- ===========================================================================
-- ASSIGNMENTS
-- ===========================================================================

-- Teachers manage their own assignments end to end.
CREATE POLICY assignments_teacher_own ON assignments
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Co-teachers (other teachers on the same period) can read and update.
CREATE POLICY assignments_coteacher_read ON assignments
  FOR SELECT TO authenticated
  USING (
    class_period_id IS NOT NULL
    AND auth_user_teaches_class_period(class_period_id)
  );

CREATE POLICY assignments_coteacher_update ON assignments
  FOR UPDATE TO authenticated
  USING (
    class_period_id IS NOT NULL
    AND auth_user_teaches_class_period(class_period_id)
  )
  WITH CHECK (
    class_period_id IS NOT NULL
    AND auth_user_teaches_class_period(class_period_id)
  );

-- Admins read in scope.
CREATE POLICY assignments_admin_read ON assignments
  FOR SELECT TO authenticated
  USING (auth_user_is_admin_for_school(school_id));

-- Students read assignments only when:
--   1. They're enrolled in the assignment's class period.
--   2. The assignment has been released (released_at is NULL or in the past).
CREATE POLICY assignments_student_read ON assignments
  FOR SELECT TO authenticated
  USING (
    class_period_id IS NOT NULL
    AND auth_user_enrolled_in_class_period(class_period_id)
    AND (released_at IS NULL OR released_at <= NOW())
  );

-- ===========================================================================
-- STUDENT WRITINGS + per-writing artifacts
-- ===========================================================================

-- ---- student_writings ---------------------------------------------------

-- Students manage their own writings (with status guard for editing).
CREATE POLICY student_writings_student_select ON student_writings
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY student_writings_student_insert ON student_writings
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_id
        AND a.class_period_id IS NOT NULL
        AND auth_user_enrolled_in_class_period(a.class_period_id)
        AND (a.released_at IS NULL OR a.released_at <= NOW())
        AND (a.closed_at IS NULL OR a.closed_at > NOW())
    )
  );

CREATE POLICY student_writings_student_update ON student_writings
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    AND status IN ('draft', 'in_progress', 'returned')
  )
  WITH CHECK (
    student_id = auth.uid()
    -- Students can move forward (draft→in_progress→submitted) but not
    -- back to a teacher-only state. Admins/teachers handle 'graded'.
    AND status IN ('draft', 'in_progress', 'submitted')
  );

-- Teachers read+update writings for their assignments.
CREATE POLICY student_writings_teacher_select ON student_writings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (
          a.teacher_id = auth.uid()
          OR (a.class_period_id IS NOT NULL AND auth_user_teaches_class_period(a.class_period_id))
        )
    )
  );

CREATE POLICY student_writings_teacher_update ON student_writings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (
          a.teacher_id = auth.uid()
          OR (a.class_period_id IS NOT NULL AND auth_user_teaches_class_period(a.class_period_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND (
          a.teacher_id = auth.uid()
          OR (a.class_period_id IS NOT NULL AND auth_user_teaches_class_period(a.class_period_id))
        )
    )
  );

CREATE POLICY student_writings_admin_read ON student_writings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = student_writings.assignment_id
        AND auth_user_is_admin_for_school(a.school_id)
    )
  );

-- ---- per-writing artifacts ---------------------------------------------
-- Every artifact table follows the same pattern: gate by writing access.
-- Read needs auth_user_can_read_writing; write needs auth_user_can_write_writing.

-- prompt_decodings
CREATE POLICY prompt_decodings_read ON prompt_decodings
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY prompt_decodings_write ON prompt_decodings
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- text_annotations
CREATE POLICY text_annotations_read ON text_annotations
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY text_annotations_write ON text_annotations
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- gathering_cds_sheets
CREATE POLICY gathering_cds_sheets_read ON gathering_cds_sheets
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY gathering_cds_sheets_write ON gathering_cds_sheets
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- candidate_cds (gated by parent gathering_cds_sheets)
CREATE POLICY candidate_cds_read ON candidate_cds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gathering_cds_sheets g
      WHERE g.id = candidate_cds.gathering_sheet_id
        AND auth_user_can_read_writing(g.student_writing_id)
    )
  );
CREATE POLICY candidate_cds_write ON candidate_cds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gathering_cds_sheets g
      WHERE g.id = candidate_cds.gathering_sheet_id
        AND auth_user_can_write_writing(g.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gathering_cds_sheets g
      WHERE g.id = candidate_cds.gathering_sheet_id
        AND auth_user_can_write_writing(g.student_writing_id)
    )
  );

-- body_paragraphs
CREATE POLICY body_paragraphs_read ON body_paragraphs
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY body_paragraphs_write ON body_paragraphs
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- t_charts (gated by body_paragraph)
CREATE POLICY t_charts_read ON t_charts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = t_charts.body_paragraph_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY t_charts_write ON t_charts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = t_charts.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = t_charts.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- chunks (gated by body_paragraph)
CREATE POLICY chunks_read ON chunks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = chunks.body_paragraph_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY chunks_write ON chunks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = chunks.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = chunks.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- concrete_details (gated by chunk → body_paragraph → writing)
CREATE POLICY concrete_details_read ON concrete_details
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = concrete_details.chunk_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY concrete_details_write ON concrete_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = concrete_details.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = concrete_details.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- commentary_items
CREATE POLICY commentary_items_read ON commentary_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = commentary_items.chunk_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY commentary_items_write ON commentary_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = commentary_items.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chunks c
      JOIN body_paragraphs bp ON bp.id = c.body_paragraph_id
      WHERE c.id = commentary_items.chunk_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- shaping_sheets (gated by body_paragraph)
CREATE POLICY shaping_sheets_read ON shaping_sheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = shaping_sheets.body_paragraph_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY shaping_sheets_write ON shaping_sheets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = shaping_sheets.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = shaping_sheets.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- shaping_chunk_outputs
CREATE POLICY shaping_chunk_outputs_read ON shaping_chunk_outputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shaping_sheets ss
      JOIN body_paragraphs bp ON bp.id = ss.body_paragraph_id
      WHERE ss.id = shaping_chunk_outputs.shaping_sheet_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY shaping_chunk_outputs_write ON shaping_chunk_outputs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shaping_sheets ss
      JOIN body_paragraphs bp ON bp.id = ss.body_paragraph_id
      WHERE ss.id = shaping_chunk_outputs.shaping_sheet_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shaping_sheets ss
      JOIN body_paragraphs bp ON bp.id = ss.body_paragraph_id
      WHERE ss.id = shaping_chunk_outputs.shaping_sheet_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- essay_parts
CREATE POLICY essay_parts_read ON essay_parts
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY essay_parts_write ON essay_parts
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- paragraph_forms (gated by body_paragraph)
CREATE POLICY paragraph_forms_read ON paragraph_forms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = paragraph_forms.body_paragraph_id
        AND auth_user_can_read_writing(bp.student_writing_id)
    )
  );
CREATE POLICY paragraph_forms_write ON paragraph_forms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = paragraph_forms.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_paragraphs bp
      WHERE bp.id = paragraph_forms.body_paragraph_id
        AND auth_user_can_write_writing(bp.student_writing_id)
    )
  );

-- final_drafts
CREATE POLICY final_drafts_read ON final_drafts
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY final_drafts_write ON final_drafts
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- step_progress
CREATE POLICY step_progress_read ON step_progress
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));
CREATE POLICY step_progress_write ON step_progress
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));

-- ===========================================================================
-- TEACHER FEEDBACK
-- ===========================================================================
-- Teachers can create feedback on writings they have access to. Students
-- can read feedback on their own writings. Teachers can update/delete only
-- their own feedback (no editing other teachers' comments).

CREATE POLICY teacher_feedback_read ON teacher_feedback
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));

CREATE POLICY teacher_feedback_teacher_insert ON teacher_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND auth_user_role() IN ('teacher','school_admin','district_admin','super_admin')
    AND auth_user_can_write_writing(student_writing_id)
  );

CREATE POLICY teacher_feedback_teacher_update ON teacher_feedback
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY teacher_feedback_teacher_delete ON teacher_feedback
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- Students can mark feedback resolved (small UPDATE) on their own writings.
CREATE POLICY teacher_feedback_student_resolve ON teacher_feedback
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_writings sw
      WHERE sw.id = teacher_feedback.student_writing_id
        AND sw.student_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Only the resolved flag may change for students; everything else stays.
    teacher_id = (SELECT teacher_id FROM teacher_feedback WHERE id = teacher_feedback.id)
    AND target_kind = (SELECT target_kind FROM teacher_feedback WHERE id = teacher_feedback.id)
    AND target_id = (SELECT target_id FROM teacher_feedback WHERE id = teacher_feedback.id)
    AND body = (SELECT body FROM teacher_feedback WHERE id = teacher_feedback.id)
  );

COMMIT;
