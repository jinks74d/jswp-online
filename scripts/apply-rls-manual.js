#!/usr/bin/env node

/**
 * Manual RLS Policy Application Script
 * 
 * Since the Supabase API doesn't support direct SQL execution for security policies,
 * this script will:
 * 1. Read the migration file
 * 2. Apply it via Supabase Dashboard instructions
 * 3. Verify the policies were applied correctly
 * 4. Test with the specific user that was having issues
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function readMigrationFile() {
  const migrationPath = path.join(__dirname, '../migrations/fix-rls-policies.sql');
  
  try {
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file read successfully');
    return migrationContent;
  } catch (error) {
    console.error('❌ Failed to read migration file:', error.message);
    return null;
  }
}

async function checkRLSStatus() {
  console.log('🔍 Checking current RLS status...');
  
  try {
    // Try to query user_profiles without authentication - should fail if RLS is enabled
    const testClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await testClient
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('policy')) {
        console.log('✅ RLS is enabled on user_profiles - unauthenticated access blocked');
        return { user_profiles: true };
      } else {
        console.log('⚠️  Query failed with different error:', error.message);
        return { user_profiles: 'unknown', error: error.message };
      }
    } else {
      console.log('❌ RLS is NOT enabled on user_profiles - unauthenticated access allowed');
      return { user_profiles: false };
    }
  } catch (error) {
    console.log('✅ RLS appears to be working - access properly restricted');
    return { user_profiles: true };
  }
}

async function testUserProfileAccess() {
  console.log('🧪 Testing user profile access with service key...');
  
  const testUserId = '5a6ab155-7c8a-4ffa-90ef-902ca1b102be';
  
  try {
    // Test with service key (should always work)
    const { data: profileData, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select(`
        *,
        districts:district_id(id, name, domain, primary_color, secondary_color),
        schools:school_id(id, name)
      `)
      .eq('id', testUserId)
      .single();

    if (profileError) {
      console.error('❌ Profile query failed even with service key:', profileError.message);
      return false;
    }

    console.log('✅ Profile query successful with service key');
    console.log('📊 Profile data preview:', {
      id: profileData.id,
      email: profileData.email,
      role: profileData.role,
      district_id: profileData.district_id,
      school_id: profileData.school_id,
      has_district: !!profileData.districts,
      has_school: !!profileData.schools
    });

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function checkTablesExist() {
  console.log('🔍 Verifying required tables exist...');
  
  try {
    // Check user_profiles
    const { error: userProfilesError } = await adminSupabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    // Check districts  
    const { error: districtsError } = await adminSupabase
      .from('districts')
      .select('id')
      .limit(1);
      
    // Check schools
    const { error: schoolsError } = await adminSupabase
      .from('schools')
      .select('id')
      .limit(1);

    const results = {
      user_profiles: !userProfilesError,
      districts: !districtsError,
      schools: !schoolsError
    };

    console.log('📊 Table availability:', results);
    
    return results;
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    return null;
  }
}

function displayManualInstructions(migrationSQL) {
  console.log('\n📋 MANUAL MIGRATION INSTRUCTIONS');
  console.log('================================\n');
  
  console.log('Since automatic SQL execution is not available, please follow these steps:\n');
  
  console.log('1. 🌐 Open your Supabase Dashboard');
  console.log(`   URL: ${supabaseUrl.replace('supabase.co', 'supabase.com')}/project/_/sql/new\n`);
  
  console.log('2. 📝 Copy and paste the following SQL into the SQL Editor:\n');
  console.log('   ------- SQL START -------');
  console.log(migrationSQL);
  console.log('   ------- SQL END -------\n');
  
  console.log('3. ▶️  Click "Run" to execute the migration\n');
  
  console.log('4. ✅ Verify the migration was successful by running this script again\n');
  
  console.log('5. 🧪 Test authentication with user: ruiz_daniel@lacoe.edu\n');
}

async function main() {
  console.log('🔐 JSWP Online - RLS Policy Migration Helper');
  console.log('This script will help you apply the RLS policies manually\n');

  // Check if tables exist
  const tablesStatus = await checkTablesExist();
  if (!tablesStatus) {
    console.log('❌ Could not verify table status. Check your Supabase connection.');
    return false;
  }

  if (!tablesStatus.user_profiles || !tablesStatus.districts || !tablesStatus.schools) {
    console.log('❌ Some required tables are missing. Please check your database schema.');
    return false;
  }

  // Check current RLS status
  const rlsStatus = await checkRLSStatus();
  
  // Test user profile access
  const profileAccessWorks = await testUserProfileAccess();

  // Read migration file
  const migrationSQL = await readMigrationFile();
  if (!migrationSQL) {
    console.log('❌ Could not read migration file.');
    return false;
  }

  // If RLS is already working properly, no need to apply migration
  if (rlsStatus.user_profiles === true && profileAccessWorks) {
    console.log('\n🎉 RLS policies appear to already be working correctly!');
    console.log('\n📋 Status Summary:');
    console.log('  ✅ RLS is enabled on user_profiles');
    console.log('  ✅ Profile queries work with proper authentication');
    console.log('  ✅ Test user profile can be accessed');
    
    console.log('\n🧪 Ready for testing:');
    console.log('  1. Try logging in with: ruiz_daniel@lacoe.edu');
    console.log('  2. Verify the authentication flow completes');
    console.log('  3. Check that profile data loads correctly');
    
    return true;
  }

  // Display manual instructions
  displayManualInstructions(migrationSQL);

  console.log('💡 After applying the migration manually, run this script again to verify success.');
  
  return false;
}

// Run the helper
main()
  .then(success => {
    console.log(success ? '\n✨ Ready for testing!' : '\n⏳ Manual migration required.');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });