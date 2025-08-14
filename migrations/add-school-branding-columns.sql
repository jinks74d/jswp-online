-- Add branding columns to schools table
-- This migration adds primary_color, secondary_color, and logo_url to the schools table

ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS primary_color TEXT,
ADD COLUMN IF NOT EXISTS secondary_color TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN schools.primary_color IS 'Primary brand color for the school (hex format), falls back to district color if null';
COMMENT ON COLUMN schools.secondary_color IS 'Secondary brand color for the school (hex format), falls back to district color if null';
COMMENT ON COLUMN schools.logo_url IS 'URL to school logo image, falls back to district logo if null';

-- Update RLS policies for schools table to allow school and district admins to update these fields
-- The existing policies should already cover this, but we'll verify

-- Ensure school admins can update their own school's branding
DO $$
BEGIN
    -- Check if policy exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schools' 
        AND policyname = 'School admins can update own school'
    ) THEN
        CREATE POLICY "School admins can update own school"
        ON schools
        FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'school_admin'
                AND user_profiles.school_id = schools.id
            )
        );
    END IF;
END
$$;

-- Ensure district admins can update schools in their district
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schools' 
        AND policyname = 'District admins can update schools in district'
    ) THEN
        CREATE POLICY "District admins can update schools in district"
        ON schools
        FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'district_admin'
                AND user_profiles.district_id = schools.district_id
            )
        );
    END IF;
END
$$;