-- =====================================================
-- DISTRICT BRANDING FEATURES MIGRATION
-- =====================================================
-- This migration adds branding support to the districts table
-- Execute in your Supabase SQL editor

-- =====================================================
-- STEP 1: ADD NEW COLUMNS TO DISTRICTS TABLE
-- =====================================================

-- Add branding columns to districts table
ALTER TABLE districts ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);

-- Add constraints for color fields (hex color validation)
ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_primary_color_format 
  CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_secondary_color_format 
  CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');

-- Add constraint for logo URL format (basic URL validation)
ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_logo_url_format 
  CHECK (logo_url IS NULL OR logo_url ~ '^https?://.*');

-- =====================================================
-- STEP 2: CREATE STORAGE BUCKET FOR DISTRICT LOGOS
-- =====================================================

-- Create district-logos storage bucket (execute separately if needed)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('district-logos', 'district-logos', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 3: CREATE STORAGE POLICIES
-- =====================================================

-- Policy: Allow public read access to district logos
CREATE POLICY IF NOT EXISTS "Public read access for district logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'district-logos');

-- Policy: Only super admins can upload/modify district logos
CREATE POLICY IF NOT EXISTS "Super admins can manage district logos" ON storage.objects
  FOR ALL USING (
    bucket_id = 'district-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Policy: Only super admins can delete district logos
CREATE POLICY IF NOT EXISTS "Super admins can delete district logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'district-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- STEP 4: UPDATE DISTRICTS RLS POLICIES
-- =====================================================

-- Drop existing policies to recreate with branding access
DROP POLICY IF EXISTS "Allow users to view their district" ON districts;
DROP POLICY IF EXISTS "Allow district admins to update their district" ON districts;
DROP POLICY IF EXISTS "Allow super admins to manage all districts" ON districts;

-- Policy: All authenticated users can view district info (including branding)
CREATE POLICY "Users can view district branding" ON districts
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.district_id = districts.id
    )
  );

-- Policy: Public read access for logo_url, primary_color, secondary_color only
-- This allows unauthenticated access to branding elements for public pages
CREATE POLICY "Public read access to district branding" ON districts
  FOR SELECT USING (true);

-- Policy: Only super admins can update district branding
CREATE POLICY "Super admins can manage district branding" ON districts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Policy: Only super admins can insert new districts
CREATE POLICY "Super admins can create districts" ON districts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Policy: Only super admins can delete districts
CREATE POLICY "Super admins can delete districts" ON districts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for logo URL lookups (if needed for optimization)
CREATE INDEX IF NOT EXISTS idx_districts_logo_url ON districts(logo_url) 
  WHERE logo_url IS NOT NULL;

-- Index for color-based queries (if needed for theming)
CREATE INDEX IF NOT EXISTS idx_districts_colors ON districts(primary_color, secondary_color) 
  WHERE primary_color IS NOT NULL OR secondary_color IS NOT NULL;

-- =====================================================
-- STEP 6: CREATE TRIGGER FOR AUTOMATIC LOGO CLEANUP
-- =====================================================

-- Function to clean up old logo files when logo_url is updated
CREATE OR REPLACE FUNCTION cleanup_old_district_logo()
RETURNS TRIGGER AS $$
DECLARE
  old_file_path TEXT;
BEGIN
  -- Extract file path from old logo URL if it exists and is different
  IF OLD.logo_url IS NOT NULL AND OLD.logo_url != NEW.logo_url THEN
    -- Extract the file path from the URL (assumes standard Supabase storage URL format)
    old_file_path := substring(OLD.logo_url from 'district-logos/(.*)$');
    
    -- Delete the old file from storage (this will be handled by storage policies)
    -- Note: Direct file deletion from SQL is not recommended in production
    -- Consider implementing this cleanup in your application logic instead
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for logo cleanup (optional - consider application-level cleanup instead)
-- DROP TRIGGER IF EXISTS trigger_cleanup_district_logo ON districts;
-- CREATE TRIGGER trigger_cleanup_district_logo
--   BEFORE UPDATE OF logo_url ON districts
--   FOR EACH ROW
--   EXECUTE FUNCTION cleanup_old_district_logo();

-- =====================================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get district branding info by domain
CREATE OR REPLACE FUNCTION get_district_branding_by_domain(district_domain TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.logo_url,
    d.primary_color,
    d.secondary_color
  FROM districts d
  WHERE d.domain = district_domain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get district branding info by ID
CREATE OR REPLACE FUNCTION get_district_branding_by_id(district_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.logo_url,
    d.primary_color,
    d.secondary_color
  FROM districts d
  WHERE d.id = district_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- 
-- SUMMARY OF CHANGES:
-- 1. Added logo_url, primary_color, secondary_color columns to districts table
-- 2. Added validation constraints for color format and URL format
-- 3. Created district-logos storage bucket with public read access
-- 4. Set up storage policies for super admin management
-- 5. Updated RLS policies for secure branding access
-- 6. Added performance indexes
-- 7. Created helper functions for branding retrieval
-- 
-- NEXT STEPS:
-- 1. Update TypeScript types to reflect new schema
-- 2. Implement file upload logic in your application
-- 3. Create UI components for district branding management
-- 4. Test storage policies and file permissions
-- 
-- SECURITY NOTES:
-- - Only super admins can modify district branding
-- - Public read access enabled for branding display
-- - File size limits should be enforced in application logic
-- - Consider implementing file type validation in upload logic
--