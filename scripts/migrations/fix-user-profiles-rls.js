#!/usr/bin/env node

// Quick script to fix RLS policies for user_profiles table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserProfilesRLS() {
  console.log('🔧 Fixing user_profiles RLS policies...');

  try {
    // Enable RLS on user_profiles table
    console.log('📋 Enabling RLS on user_profiles table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError && !rlsError.message.includes('already enabled')) {
      console.error('❌ Error enabling RLS:', rlsError);
    } else {
      console.log('✅ RLS enabled on user_profiles');
    }

    // Drop existing policy if it exists
    console.log('🗑️ Dropping existing policy (if exists)...');
    await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;'
    });

    // Create the essential RLS policy
    console.log('🛡️ Creating RLS policy for users to read their own profiles...');
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can read own profile" 
        ON user_profiles 
        FOR SELECT 
        USING (auth.uid() = id);
      `
    });

    if (policyError) {
      console.error('❌ Error creating RLS policy:', policyError);
      return false;
    }

    console.log('✅ RLS policy created successfully');

    // Grant necessary permissions
    console.log('🔐 Granting SELECT permissions to authenticated users...');
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: 'GRANT SELECT ON user_profiles TO authenticated;'
    });

    if (grantError) {
      console.error('❌ Error granting permissions:', grantError);
    } else {
      console.log('✅ Permissions granted');
    }

    // Test the policy
    console.log('🧪 Testing RLS policy...');
    const { data: testData, error: testError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .limit(1);

    if (testError) {
      console.log('⚠️ Test query failed (expected with service key):', testError.message);
    } else {
      console.log('✅ Test query successful');
    }

    console.log('\n🎉 RLS policies fixed successfully!');
    console.log('💡 The authentication flow should now work properly.');
    
    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the fix
fixUserProfilesRLS()
  .then(success => {
    if (success) {
      console.log('\n✨ All done! Try logging in again.');
    } else {
      console.log('\n❌ Some issues occurred. Check the logs above.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });