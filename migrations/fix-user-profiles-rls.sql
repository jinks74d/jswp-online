-- Fix missing RLS policies for user_profiles table
-- This is critical for the authentication flow to work properly

-- First, enable RLS on user_profiles if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "District admins can read profiles in their district" ON user_profiles;
DROP POLICY IF EXISTS "School admins can read profiles in their school" ON user_profiles;

-- Core policy: Users can read their own profile
-- This is ESSENTIAL for authentication flow
CREATE POLICY "Users can read own profile" 
ON user_profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Allow super admins to read all profiles
CREATE POLICY "Super admins can read all profiles" 
ON user_profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role = 'super_admin'::user_role
  )
);

-- Allow district admins to read profiles in their district
CREATE POLICY "District admins can read profiles in their district" 
ON user_profiles 
FOR SELECT 
USING (
  district_id IN (
    SELECT up.district_id 
    FROM user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role = 'district_admin'::user_role
  )
);

-- Allow school admins to read profiles in their school
CREATE POLICY "School admins can read profiles in their school" 
ON user_profiles 
FOR SELECT 
USING (
  school_id IN (
    SELECT up.school_id 
    FROM user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role = 'school_admin'::user_role
  )
);

-- Grant necessary permissions to authenticated users
GRANT SELECT ON user_profiles TO authenticated;

-- Note: These policies ensure that:
-- 1. Every authenticated user can read their own profile (critical for auth flow)
-- 2. Admins can read profiles within their scope
-- 3. The authentication provider can fetch user profiles successfully