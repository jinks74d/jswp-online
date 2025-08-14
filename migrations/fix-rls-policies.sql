-- Fix RLS policies for user_profiles, districts, and schools tables
-- This migration ensures users can read their own profiles and associated data

-- =============================================================================
-- USER PROFILES TABLE RLS
-- =============================================================================

-- Enable RLS on user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create policy allowing users to read their own profiles
CREATE POLICY "Users can read own profile" 
ON user_profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Create policy allowing users to update their own profiles
CREATE POLICY "Users can update own profile" 
ON user_profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

-- =============================================================================
-- DISTRICTS TABLE RLS
-- =============================================================================

-- Enable RLS on districts table
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read districts they belong to" ON districts;

-- Create policy allowing users to read districts they belong to
CREATE POLICY "Users can read districts they belong to" 
ON districts 
FOR SELECT 
USING (
  id IN (
    SELECT district_id 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND district_id IS NOT NULL
  )
);

-- Grant necessary permissions
GRANT SELECT ON districts TO authenticated;

-- =============================================================================
-- SCHOOLS TABLE RLS
-- =============================================================================

-- Enable RLS on schools table
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read schools they belong to" ON schools;

-- Create policy allowing users to read schools they belong to
CREATE POLICY "Users can read schools they belong to" 
ON schools 
FOR SELECT 
USING (
  -- User's direct school
  id IN (
    SELECT school_id 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND school_id IS NOT NULL
  )
  OR
  -- All schools in user's district (for district admins)
  district_id IN (
    SELECT district_id 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND district_id IS NOT NULL
  )
);

-- Grant necessary permissions
GRANT SELECT ON schools TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('user_profiles', 'districts', 'schools') 
AND schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'districts', 'schools') 
AND schemaname = 'public';