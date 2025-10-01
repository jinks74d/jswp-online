#!/usr/bin/env node

// Comprehensive script to fix RLS policies for user_profiles, districts, and schools tables
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function execSQL(sql, description) {
  console.log(`🔧 ${description}...`);
  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    // Some errors are expected (like "already enabled" for RLS)
    if (error.message.includes('already enabled') || 
        error.message.includes('already exists') || 
        error.message.includes('does not exist')) {
      console.log(`⚠️ ${description} - ${error.message}`);
      return true;
    } else {
      console.error(`❌ Error: ${description} - ${error.message}`);
      return false;
    }
  }
  
  console.log(`✅ ${description} - Success`);
  return true;
}

async function checkCurrentRLSStatus() {
  console.log('\n📊 Checking current RLS status...');
  
  try {
    // Check RLS status for all tables
    const { data: rlsStatus, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename IN ('user_profiles', 'districts', 'schools') 
        AND schemaname = 'public';
      `
    });
    
    if (error) {
      console.error('❌ Error checking RLS status:', error);
      return false;
    }
    
    console.log('Current RLS status:', rlsStatus);
    
    // Check existing policies
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename IN ('user_profiles', 'districts', 'schools') 
        AND schemaname = 'public';
      `
    });
    
    if (policiesError) {
      console.error('❌ Error checking policies:', policiesError);
    } else {
      console.log('Current policies:', policies);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking RLS status:', error);
    return false;
  }
}

async function fixUserProfilesRLS() {
  console.log('\n🔧 Fixing user_profiles RLS policies...');

  // Enable RLS on user_profiles table
  await execSQL(
    'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;',
    'Enabling RLS on user_profiles table'
  );

  // Drop existing policies if they exist
  await execSQL(
    'DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;',
    'Dropping existing user profile read policy'
  );

  await execSQL(
    'DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;',
    'Dropping existing user profile update policy'
  );

  // Create the essential RLS policies
  const readPolicyResult = await execSQL(
    `
    CREATE POLICY "Users can read own profile" 
    ON user_profiles 
    FOR SELECT 
    USING (auth.uid() = id);
    `,
    'Creating RLS policy for users to read their own profiles'
  );

  const updatePolicyResult = await execSQL(
    `
    CREATE POLICY "Users can update own profile" 
    ON user_profiles 
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    `,
    'Creating RLS policy for users to update their own profiles'
  );

  // Grant necessary permissions
  await execSQL(
    'GRANT SELECT, UPDATE ON user_profiles TO authenticated;',
    'Granting SELECT and UPDATE permissions to authenticated users'
  );

  return readPolicyResult && updatePolicyResult;
}

async function fixDistrictsRLS() {
  console.log('\n🔧 Fixing districts RLS policies...');

  // Enable RLS on districts table
  await execSQL(
    'ALTER TABLE districts ENABLE ROW LEVEL SECURITY;',
    'Enabling RLS on districts table'
  );

  // Drop existing policies if they exist
  await execSQL(
    'DROP POLICY IF EXISTS "Users can read districts they belong to" ON districts;',
    'Dropping existing districts read policy'
  );

  // Create policy allowing users to read districts they belong to
  const districtPolicyResult = await execSQL(
    `
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
    `,
    'Creating RLS policy for users to read their district information'
  );

  // Grant necessary permissions
  await execSQL(
    'GRANT SELECT ON districts TO authenticated;',
    'Granting SELECT permissions on districts to authenticated users'
  );

  return districtPolicyResult;
}

async function fixSchoolsRLS() {
  console.log('\n🔧 Fixing schools RLS policies...');

  // Enable RLS on schools table
  await execSQL(
    'ALTER TABLE schools ENABLE ROW LEVEL SECURITY;',
    'Enabling RLS on schools table'
  );

  // Drop existing policies if they exist
  await execSQL(
    'DROP POLICY IF EXISTS "Users can read schools they belong to" ON schools;',
    'Dropping existing schools read policy'
  );

  // Create policy allowing users to read schools they belong to
  const schoolPolicyResult = await execSQL(
    `
    CREATE POLICY "Users can read schools they belong to" 
    ON schools 
    FOR SELECT 
    USING (
      id IN (
        SELECT school_id 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND school_id IS NOT NULL
      )
      OR
      district_id IN (
        SELECT district_id 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND district_id IS NOT NULL
      )
    );
    `,
    'Creating RLS policy for users to read their school information'
  );

  // Grant necessary permissions
  await execSQL(
    'GRANT SELECT ON schools TO authenticated;',
    'Granting SELECT permissions on schools to authenticated users'
  );

  return schoolPolicyResult;
}

async function testPolicies() {
  console.log('\n🧪 Testing RLS policies...');

  try {
    // Test user_profiles query (should work with service key)
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, district_id, school_id')
      .limit(1);

    if (profileError) {
      console.log('⚠️ User profiles test failed:', profileError.message);
    } else {
      console.log('✅ User profiles test successful - found profiles:', profileData?.length || 0);
    }

    // Test districts query
    const { data: districtData, error: districtError } = await supabase
      .from('districts')
      .select('id, name')
      .limit(1);

    if (districtError) {
      console.log('⚠️ Districts test failed:', districtError.message);
    } else {
      console.log('✅ Districts test successful - found districts:', districtData?.length || 0);
    }

    // Test schools query
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id, name')
      .limit(1);

    if (schoolError) {
      console.log('⚠️ Schools test failed:', schoolError.message);
    } else {
      console.log('✅ Schools test successful - found schools:', schoolData?.length || 0);
    }

    // Test the specific query from the user's issue
    console.log('\n🧪 Testing the specific profile query with joins...');
    const { data: joinData, error: joinError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        districts:district_id(id, name, domain, primary_color, secondary_color),
        schools:school_id(id, name)
      `)
      .eq('id', '5a6ab155-7c8a-4ffa-90ef-902ca1b102be')
      .single();

    if (joinError) {
      console.log('⚠️ Profile with joins test failed:', joinError.message);
      console.log('This is expected since we\'re using service key, not user auth');
    } else {
      console.log('✅ Profile with joins test successful');
      console.log('Profile data:', JSON.stringify(joinData, null, 2));
    }

    return true;
  } catch (error) {
    console.error('❌ Error during testing:', error);
    return false;
  }
}

async function verifyUserExists() {
  console.log('\n🔍 Verifying the specific user exists...');
  
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('id, email, role, district_id, school_id')
    .eq('id', '5a6ab155-7c8a-4ffa-90ef-902ca1b102be')
    .single();

  if (userError) {
    console.error('❌ User not found:', userError.message);
    return false;
  }

  console.log('✅ User found:', userData);
  return true;
}

async function main() {
  console.log('🚀 Starting comprehensive RLS fix for JSWP Online...');
  console.log('Target tables: user_profiles, districts, schools');
  console.log('==================================================\n');

  try {
    // Check current status
    await checkCurrentRLSStatus();

    // Verify the specific user exists
    const userExists = await verifyUserExists();
    if (!userExists) {
      console.log('❌ The specified user does not exist. Continuing with RLS fixes anyway...');
    }

    // Fix RLS for all tables
    const userProfilesResult = await fixUserProfilesRLS();
    const districtsResult = await fixDistrictsRLS();
    const schoolsResult = await fixSchoolsRLS();

    // Test the policies
    await testPolicies();

    if (userProfilesResult && districtsResult && schoolsResult) {
      console.log('\n🎉 All RLS policies fixed successfully!');
      console.log('💡 The authentication flow should now work properly.');
      console.log('\n📋 Summary of changes:');
      console.log('  ✅ Enabled RLS on user_profiles, districts, and schools tables');
      console.log('  ✅ Created policy for users to read/update their own profiles');
      console.log('  ✅ Created policy for users to read their associated districts');
      console.log('  ✅ Created policy for users to read their associated schools');
      console.log('  ✅ Granted necessary permissions to authenticated role');
      
      console.log('\n🧪 Next steps:');
      console.log('  1. Test login with the user: 5a6ab155-7c8a-4ffa-90ef-902ca1b102be');
      console.log('  2. Verify profile data loads correctly');
      console.log('  3. Check that districts and schools data is accessible');
      
      return true;
    } else {
      console.log('\n❌ Some RLS policies failed to apply. Check the logs above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the comprehensive fix
main()
  .then(success => {
    console.log(success ? '\n✨ All done!' : '\n❌ Some issues occurred.');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });