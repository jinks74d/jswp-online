-- ============================================================================
-- JSWP Online — Dev Seed Data (0004)
-- ============================================================================
-- Idempotent dev seed. Creates one district, one school, subjects/classes/
-- periods, and one demo assignment per writing mode.
--
-- IMPORTANT: This script does NOT create auth.users records. Auth users
-- must be created via Supabase Auth (UI, magic link, or admin API), then
-- linked here by ID. Use scripts/seed-auth.ts for the auth.users side.
--
-- After signing up four test users in your Supabase project (super admin,
-- a teacher, two students), copy their UUIDs into the placeholder rows
-- below and re-run this script. Or run scripts/seed-auth.ts which handles
-- both sides automatically.
--
-- Re-runnable: every INSERT uses ON CONFLICT to skip duplicates.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- District + School
-- ---------------------------------------------------------------------------

INSERT INTO districts (id, name, subdomain, primary_color, secondary_color, contact_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo District',
  'demo',
  '#1E40AF',                                          -- indigo
  '#0891B2',                                          -- cyan
  'admin@demo.test'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schools (id, district_id, name, level)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Demo High School',
  'high'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Test users (linked to auth.users by matching UUID).
-- Replace the placeholder UUIDs below with real auth.users IDs you create
-- via Supabase Auth before running this seed for the first time.
-- ---------------------------------------------------------------------------

-- Super admin (no school; district-scoped)
INSERT INTO user_profiles (id, district_id, school_id, role, first_name, last_name, email)
VALUES (
  '6e0c3f40-7ecd-4e83-a883-14daa4b0f91b',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'super_admin',
  'Raymond',
  'Jenkins',
  'raymond@farsidedev.com'
)
ON CONFLICT (id) DO NOTHING;

-- Teacher
INSERT INTO user_profiles (id, district_id, school_id, role, first_name, last_name, email)
VALUES (
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'teacher',
  'Ms.',
  'Schaffer',
  'teacher@demo.test'
)
ON CONFLICT (id) DO NOTHING;

-- Two students
INSERT INTO user_profiles (id, district_id, school_id, role, first_name, last_name, email, grade_level)
VALUES
  (
    '30d8b2f9-0bf9-4044-a254-9b8a0612b584',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'student',
    'Alex',
    'Student',
    'alex@demo.test',
    '10'
  ),
  (
    '0dffb149-abcd-4381-9f51-aa143720a9fd',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'student',
    'Bailey',
    'Student',
    'bailey@demo.test',
    '10'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Subjects, Classes, Periods
-- ---------------------------------------------------------------------------

INSERT INTO subjects (id, school_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000010', 'English', 'English Language Arts'),
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000010', 'Social Studies', 'World and US History')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, subject_id, school_id, name)
VALUES
  ('00000000-0000-0000-0000-000000002000', '00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000010', 'English I'),
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000010', 'World History')
ON CONFLICT (id) DO NOTHING;

INSERT INTO class_periods (id, class_id, school_id, period_label, academic_year, created_by)
VALUES
  (
    '00000000-0000-0000-0000-000000003000',
    '00000000-0000-0000-0000-000000002000',
    '00000000-0000-0000-0000-000000000010',
    'Period 1',
    '2025-2026',
    '939c2df8-ae49-40b8-b216-bd4d6b61ea43'
  )
ON CONFLICT (id) DO NOTHING;

-- Assign the teacher and enroll the students
INSERT INTO class_teacher_assignments (class_period_id, teacher_id, is_primary, assigned_by)
VALUES (
  '00000000-0000-0000-0000-000000003000',
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  TRUE,
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43'
)
ON CONFLICT (class_period_id, teacher_id) DO NOTHING;

INSERT INTO class_student_enrollments (class_period_id, student_id)
VALUES
  ('00000000-0000-0000-0000-000000003000', '30d8b2f9-0bf9-4044-a254-9b8a0612b584'),
  ('00000000-0000-0000-0000-000000003000', '0dffb149-abcd-4381-9f51-aa143720a9fd')
ON CONFLICT (class_period_id, student_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo assignment: Expository — "Sports & Teamwork"
-- Drawn from the 2024 Expository Guide, p. 67.
-- ---------------------------------------------------------------------------

INSERT INTO assignments (
  id, teacher_id, class_period_id, district_id, school_id,
  title, prompt, mode,
  is_essay, num_body_paragraphs, default_chunk_ratio, default_chunks_per_bp,
  released_at
)
VALUES (
  '00000000-0000-0000-0000-000000004000',
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  '00000000-0000-0000-0000-000000003000',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Sports & Teamwork',
  'Working together to achieve a goal requires team commitment. Think of two sports you enjoy. Then, in a one-chunk paragraph (2+:1), explain the importance of learning the rules of team sports.',
  'expository',
  FALSE,
  1,
  'two_plus_to_one',
  1,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo assignment: Argumentation — "Tardy Policy"
-- The iconic JSWP model, drawn from the 2019 Argumentation Guide, pp. 24-46.
-- ---------------------------------------------------------------------------

INSERT INTO assignments (
  id, teacher_id, class_period_id, district_id, school_id,
  title, prompt, mode,
  is_essay, num_body_paragraphs, default_chunk_ratio, default_chunks_per_bp, has_counterargument,
  released_at
)
VALUES (
  '00000000-0000-0000-0000-000000004001',
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  '00000000-0000-0000-0000-000000003000',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'New Tardy Policy',
  'Write a one-chunk (2+:1) paragraph that argues for or against the school''s new tardy policy.',
  'argumentation',
  FALSE,
  1,
  'two_plus_to_one',
  1,
  TRUE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo assignment: Literary — "Both Sides of the Fence"
-- Drawn from the Response to Literature Quick Start Guide.
-- ---------------------------------------------------------------------------

INSERT INTO assignments (
  id, teacher_id, class_period_id, district_id, school_id,
  title, prompt, mode,
  is_essay, num_body_paragraphs, default_chunk_ratio, default_chunks_per_bp,
  source_text, source_title, source_author, source_citation,
  released_at
)
VALUES (
  '00000000-0000-0000-0000-000000004002',
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  '00000000-0000-0000-0000-000000003000',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Both Sides of the Fence',
  'In a well-developed two-chunk paragraph (1:2+), explain how the author characterizes Alberto in the first half of the story.',
  'literary',
  FALSE,
  1,
  'one_to_two_plus',
  2,
  '[Source text would be pasted here in a real assignment]',
  'Both Sides of the Fence',
  'Teresa Bateman',
  '(Bateman 108)',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo assignment: Narrative — "Accomplishment"
-- Drawn from the 2018 Narrative Guide.
-- ---------------------------------------------------------------------------

INSERT INTO assignments (
  id, teacher_id, class_period_id, district_id, school_id,
  title, prompt, mode,
  is_essay, num_body_paragraphs, default_chunk_ratio, default_chunks_per_bp,
  released_at
)
VALUES (
  '00000000-0000-0000-0000-000000004003',
  '939c2df8-ae49-40b8-b216-bd4d6b61ea43',
  '00000000-0000-0000-0000-000000003000',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Accomplishment',
  'Write a one-chunk personal narrative paragraph (2+:1) that describes how you felt after accomplishing something at home or at school.',
  'narrative',
  FALSE,
  1,
  'two_plus_to_one',
  1,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
