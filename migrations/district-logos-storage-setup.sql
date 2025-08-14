-- =====================================================
-- DISTRICT LOGOS STORAGE BUCKET CONFIGURATION
-- =====================================================
-- This script sets up the Supabase Storage bucket for district logos
-- with proper security policies and file organization

-- =====================================================
-- STEP 1: CREATE STORAGE BUCKET
-- =====================================================

-- Create the district-logos bucket with public read access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'district-logos',
  'district-logos',
  true,
  5242880, -- 5MB file size limit
  ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- =====================================================
-- STEP 2: STORAGE SECURITY POLICIES
-- =====================================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for district logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can manage district logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can upload district logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update district logos" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete district logos" ON storage.objects;

-- Policy 1: Public read access to district logos
CREATE POLICY "Public read access for district logos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'district-logos'
  );

-- Policy 2: Super admins can upload district logos
CREATE POLICY "Super admins can upload district logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'district-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    ) AND
    -- Enforce file naming convention: district-{district_id}/logo.{ext}
    name ~ '^district-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\.(jpg|jpeg|png|webp|svg)$'
  );

-- Policy 3: Super admins can update district logos
CREATE POLICY "Super admins can update district logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'district-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Policy 4: Super admins can delete district logos
CREATE POLICY "Super admins can delete district logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'district-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- STEP 3: HELPER FUNCTIONS FOR FILE MANAGEMENT
-- =====================================================

-- Function to generate the correct file path for a district logo
CREATE OR REPLACE FUNCTION get_district_logo_path(
  district_id UUID,
  file_extension TEXT DEFAULT 'png'
)
RETURNS TEXT AS $$
BEGIN
  -- Validate file extension
  IF file_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'svg') THEN
    RAISE EXCEPTION 'Invalid file extension. Allowed: jpg, jpeg, png, webp, svg';
  END IF;
  
  -- Return the standardized path
  RETURN 'district-' || district_id::TEXT || '/logo.' || file_extension;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the full Supabase Storage URL for a district logo
CREATE OR REPLACE FUNCTION get_district_logo_url(
  district_id UUID,
  file_extension TEXT DEFAULT 'png'
)
RETURNS TEXT AS $$
DECLARE
  supabase_url TEXT;
  file_path TEXT;
BEGIN
  -- Get the Supabase URL from app settings (you may need to adjust this)
  -- For now, return the relative path - prepend with your Supabase URL in application
  file_path := get_district_logo_path(district_id, file_extension);
  
  -- Return the full URL path for Supabase Storage
  RETURN '/storage/v1/object/public/district-logos/' || file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and clean up district logo files
CREATE OR REPLACE FUNCTION cleanup_district_logos(district_id UUID)
RETURNS INT AS $$
DECLARE
  deleted_count INT := 0;
  file_record RECORD;
BEGIN
  -- Only super admins can perform cleanup
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can cleanup district logos';
  END IF;
  
  -- Count and prepare to delete old logo files for this district
  FOR file_record IN
    SELECT id, name FROM storage.objects 
    WHERE bucket_id = 'district-logos' 
    AND name LIKE 'district-' || district_id::TEXT || '/%'
  LOOP
    -- Delete the file (this will trigger storage policies)
    DELETE FROM storage.objects WHERE id = file_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: STORAGE OPTIMIZATION SETTINGS
-- =====================================================

-- Create indexes for better performance on storage queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_district_logos 
ON storage.objects(bucket_id, name) 
WHERE bucket_id = 'district-logos';

-- =====================================================
-- STEP 5: FILE ORGANIZATION REFERENCE
-- =====================================================

/*
RECOMMENDED FILE ORGANIZATION STRUCTURE:

district-logos/
├── district-{uuid1}/
│   └── logo.png (or .jpg, .webp, .svg)
├── district-{uuid2}/
│   └── logo.png
└── district-{uuid3}/
    └── logo.png

NAMING CONVENTIONS:
- Folder: district-{district_id}
- File: logo.{extension}
- Allowed extensions: jpg, jpeg, png, webp, svg
- Max file size: 5MB
- Public read access for all district logos
- Upload/modify restricted to super admins only

EXAMPLE PATHS:
- district-123e4567-e89b-12d3-a456-426614174000/logo.png
- district-987fcdeb-51a2-43d1-9c4f-123456789abc/logo.webp

FULL URLS (in application):
- https://your-supabase-url.supabase.co/storage/v1/object/public/district-logos/district-{id}/logo.png
*/

-- =====================================================
-- STORAGE SETUP COMPLETE!
-- =====================================================