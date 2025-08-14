#!/usr/bin/env node

// Check and fix RLS policies
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixRLS() {
  console.log('🔍 Checking RLS policies...');

  try {
    // Check if RLS is enabled
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, row_security')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_profiles');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    console.log('📋 Table info:', tables);

    // Check existing policies
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('policyname, roles, cmd, qual')
      .eq('tablename', 'user_profiles');

    if (policiesError) {
      console.error('❌ Error checking policies:', policiesError);
    } else {
      console.log('🛡️ Existing policies:', policies);
    }

    // Apply RLS fixes using direct SQL
    console.log('\n🔧 Applying RLS fixes...');

    // Enable RLS
    try {
      await supabase.rpc('exec', { sql: 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;' });
      console.log('✅ RLS enabled');
    } catch (error) {
      console.log('⚠️ RLS enable failed (might already be enabled):', error.message);
    }

    // Drop existing policy if it exists
    try {
      await supabase.rpc('exec', { 
        sql: 'DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;' 
      });
      console.log('🗑️ Existing policy dropped');
    } catch (error) {
      console.log('⚠️ Policy drop failed:', error.message);
    }

    // Create new policy
    try {
      await supabase.rpc('exec', { 
        sql: `CREATE POLICY "Users can read own profile" 
              ON user_profiles 
              FOR SELECT 
              USING (auth.uid() = id);` 
      });
      console.log('✅ New policy created');
    } catch (error) {
      console.error('❌ Policy creation failed:', error);
      
      // Try alternative approach - manual SQL in Supabase dashboard
      console.log('\n📋 Manual fix needed - run these commands in Supabase SQL editor:');
      console.log('');
      console.log('-- Enable RLS');
      console.log('ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Create policy');
      console.log('CREATE POLICY "Users can read own profile"');
      console.log('ON user_profiles');
      console.log('FOR SELECT');
      console.log('USING (auth.uid() = id);');
      console.log('');
      console.log('-- Grant permissions');
      console.log('GRANT SELECT ON user_profiles TO authenticated;');
      return;
    }

    // Grant permissions
    try {
      await supabase.rpc('exec', { 
        sql: 'GRANT SELECT ON user_profiles TO authenticated;' 
      });
      console.log('✅ Permissions granted');
    } catch (error) {
      console.log('⚠️ Permission grant failed:', error.message);
    }

    console.log('\n🎉 RLS policies should now be fixed!');
    console.log('💡 Try refreshing your browser');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixRLS();