-- ============================================================================
-- JSWP Online — Storage Buckets (0003)
-- ============================================================================
-- Two buckets:
--   1. district-logos  — public read, super-admin write. District branding.
--   2. assignment-sources — auth read, teacher write. Optional uploaded
--      source texts (PDFs/images) attached to assignments.
--
-- Supabase Storage uses a bucket-level table (storage.buckets) and an
-- object-level table (storage.objects). RLS is on storage.objects.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Bucket: district-logos
-- ---------------------------------------------------------------------------
-- Path convention: district-{district_id}/logo.{ext}
-- Public read so the login page can render branding without auth.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'district-logos',
  'district-logos',
  TRUE,
  5242880,                                            -- 5 MB
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read — anyone can view a district's logo. (Bucket is public, but
-- explicit policy makes intent obvious.)
CREATE POLICY district_logos_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'district-logos');

-- Super admins write/delete any logo. District admins can manage their
-- own district's logo (path prefix "district-{district_id}/").
CREATE POLICY district_logos_super_admin_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'district-logos'
    AND auth_user_role() = 'super_admin'
  )
  WITH CHECK (
    bucket_id = 'district-logos'
    AND auth_user_role() = 'super_admin'
  );

CREATE POLICY district_logos_district_admin_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'district-logos'
    AND auth_user_role() = 'district_admin'
    AND name LIKE 'district-' || auth_user_district_id()::text || '/%'
  )
  WITH CHECK (
    bucket_id = 'district-logos'
    AND auth_user_role() = 'district_admin'
    AND name LIKE 'district-' || auth_user_district_id()::text || '/%'
  );

-- ---------------------------------------------------------------------------
-- Bucket: assignment-sources
-- ---------------------------------------------------------------------------
-- Path convention: school-{school_id}/assignment-{assignment_id}/{filename}
-- Private — only authenticated users in the same school can read.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignment-sources',
  'assignment-sources',
  FALSE,
  20971520,                                           -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  -- .docx
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read access: authenticated users whose school matches the path prefix.
-- We extract the school ID from the path "school-{uuid}/..." with a regex.
CREATE POLICY assignment_sources_read_in_school ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-sources'
    AND (
      auth_user_role() = 'super_admin'
      OR (
        substring(name FROM 'school-([0-9a-f-]+)/')::uuid = auth_user_school_id()
      )
    )
  );

-- Write access: teachers and admins for their school.
CREATE POLICY assignment_sources_teacher_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'assignment-sources'
    AND auth_user_role() IN ('teacher','school_admin','district_admin','super_admin')
    AND (
      auth_user_role() = 'super_admin'
      OR substring(name FROM 'school-([0-9a-f-]+)/')::uuid = auth_user_school_id()
    )
  )
  WITH CHECK (
    bucket_id = 'assignment-sources'
    AND auth_user_role() IN ('teacher','school_admin','district_admin','super_admin')
    AND (
      auth_user_role() = 'super_admin'
      OR substring(name FROM 'school-([0-9a-f-]+)/')::uuid = auth_user_school_id()
    )
  );

COMMIT;
