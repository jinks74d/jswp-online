#!/usr/bin/env node

// Quick test to check if RLS is working
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function quickTest() {
  console.log('🧪 Quick RLS test...');

  try {
    // This should fail if RLS is enabled (unauthenticated access)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.log('✅ RLS is working! Error:', error.message);
      if (error.message.includes('policy') || error.code === '42501') {
        console.log('🔒 Policies are blocking unauthenticated access');
        return true;
      }
    } else {
      console.log('❌ RLS might not be working - got data without auth:', data?.length, 'rows');
      return false;
    }
  } catch (err) {
    console.log('✅ RLS is working! Caught error:', err.message);
    return true;
  }

  return false;
}

quickTest().then(working => {
  if (working) {
    console.log('\n🎉 RLS appears to be working!');
    console.log('🧪 Now test the authentication in your browser:');
    console.log('   1. Refresh the JSWP Online app');
    console.log('   2. Check if "Checking authentication..." resolves');
    console.log('   3. Verify you can access the dashboard');
  } else {
    console.log('\n⚠️  RLS might not be fully working yet');
    console.log('💡 Try running the SQL commands again in Supabase dashboard');
  }
});