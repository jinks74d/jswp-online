#!/usr/bin/env node

// Check RLS status and existing policies
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

async function checkRLSStatus() {
  console.log('🔍 Checking RLS status for user_profiles table...');

  try {
    // Try to query user_profiles directly to see what happens
    console.log('📋 Testing direct query to user_profiles...');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role, email')
      .limit(5);

    if (error) {
      console.error('❌ Error querying user_profiles:', error);
      console.log('💡 This suggests RLS is enabled and blocking access');
    } else {
      console.log('✅ Query successful. Found', data?.length || 0, 'profiles');
      console.log('📊 Sample data:', data?.[0]);
    }

    // Check if we can query with a specific user context
    console.log('\n🧪 Testing with auth context...');
    
    // Get a user ID from the profiles
    if (data && data.length > 0) {
      const testUserId = data[0].id;
      console.log('🎯 Testing with user ID:', testUserId);
      
      // This should work if RLS allows users to read their own profiles
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      if (profileError) {
        console.error('❌ Error fetching specific profile:', profileError);
      } else {
        console.log('✅ Successfully fetched specific profile');
      }
    }

    console.log('\n📋 Manual SQL commands to run in Supabase dashboard:');
    console.log('');
    console.log('-- Enable RLS on user_profiles table');
    console.log('ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;');
    console.log('');
    console.log('-- Create policy for users to read their own profiles');
    console.log('CREATE POLICY "Users can read own profile"');
    console.log('ON user_profiles');
    console.log('FOR SELECT');
    console.log('USING (auth.uid() = id);');
    console.log('');
    console.log('-- Grant permissions to authenticated users');
    console.log('GRANT SELECT ON user_profiles TO authenticated;');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRLSStatus();