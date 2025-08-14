# RLS Policy Fix for User Authentication

## Problem
The user authentication system is failing because users cannot read their own profiles due to missing Row Level Security (RLS) policies.

**Affected User:** `5a6ab155-7c8a-4ffa-90ef-902ca1b102be` (ruiz_daniel@lacoe.edu)

**Error:** Profile fetch returns null when using authenticated client, preventing authentication flow completion.

## Solution
Apply the following SQL commands in the **Supabase Dashboard > SQL Editor** to fix RLS policies:

---

## Step 1: Fix user_profiles Table RLS

```sql
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
```

---

## Step 2: Fix districts Table RLS

```sql
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
```

---

## Step 3: Fix schools Table RLS

```sql
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
```

---

## Step 4: Verification Queries

Run these queries to verify the policies are working:

```sql
-- Check RLS status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as status
FROM pg_tables 
WHERE tablename IN ('user_profiles', 'districts', 'schools') 
AND schemaname = 'public';

-- Check policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'districts', 'schools') 
AND schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Step 5: Test the Fix

After applying the policies, test with this query (should work for authenticated users):

```sql
-- This query should work for the authenticated user
SELECT 
  up.*,
  d.id as district_id,
  d.name as district_name,
  d.domain as district_domain,
  d.primary_color,
  d.secondary_color,
  s.id as school_id,
  s.name as school_name
FROM user_profiles up
LEFT JOIN districts d ON up.district_id = d.id
LEFT JOIN schools s ON up.school_id = s.id
WHERE up.id = auth.uid();
```

---

## Expected Results

After applying these fixes:

1. ✅ **user_profiles**: Users can read and update their own profiles
2. ✅ **districts**: Users can read district information for their assigned district
3. ✅ **schools**: Users can read school information for their assigned school or all schools in their district
4. ✅ **Authentication flow**: Profile fetch will succeed and return proper data with district/school relationships

---

## Troubleshooting

If the authentication still fails after applying these policies:

1. **Check user exists**: Verify the user `5a6ab155-7c8a-4ffa-90ef-902ca1b102be` exists in user_profiles
2. **Check auth.uid()**: Ensure the user's JWT token contains the correct user ID
3. **Check relationships**: Verify district_id and school_id are properly set in user_profiles
4. **Test manually**: Use the verification queries above in Supabase dashboard

---

## Files Created

- `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\migrations\fix-rls-policies.sql` - Complete SQL migration
- `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\scripts\fix-comprehensive-rls.js` - Node.js script (requires exec_sql function)
- `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\scripts\apply-rls-migration.js` - Alternative Node.js approach

**Recommendation**: Use the SQL commands above directly in Supabase Dashboard for immediate results.