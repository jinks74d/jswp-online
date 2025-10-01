#!/usr/bin/env node
// Simple authentication debug script
// Run with: node scripts/debug-auth-simple.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugAuth() {
  console.log('🔍 Authentication Debug Tool\n');

  // Check environment
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('📋 Environment:');
  console.log('- URL:', url ? '✅ Set' : '❌ Missing');
  console.log('- Key:', key ? '✅ Set (length: ' + key.length + ')' : '❌ Missing');
  console.log('');

  if (!url || !key) {
    console.error('❌ Missing environment variables');
    return;
  }

  // Create client
  const supabase = createClient(url, key);
  console.log('🔧 Supabase client created\n');

  try {
    // Test 1: Basic connection
    console.log('🧪 Test 1: Database Connection');
    try {
      const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
      if (error) {
        console.log('❌ Connection failed:', error.message);
        if (error.message.includes('relation "user_profiles" does not exist')) {
          console.log('🚨 CRITICAL: user_profiles table does not exist!');
          console.log('💡 This explains why profile fetching fails during authentication');
        }
      } else {
        console.log('✅ Connection successful');
      }
    } catch (err) {
      console.log('❌ Connection error:', err.message);
    }
    console.log('');

    // Test 2: Check session state
    console.log('🧪 Test 2: Session State');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.log('❌ Session check failed:', sessionError.message);
    } else {
      console.log('✅ Session check successful');
      console.log('- Current session:', sessionData.session ? 'Active' : 'None');
      if (sessionData.session) {
        console.log('- User ID:', sessionData.session.user.id);
        console.log('- Email:', sessionData.session.user.email);
      }
    }
    console.log('');

    // Test 3: Profile access test (if authenticated)
    if (sessionData.session) {
      console.log('🧪 Test 3: Profile Access Test');
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, role, email')
          .eq('id', sessionData.session.user.id)
          .single();

        if (profileError) {
          console.log('❌ Profile fetch failed:', profileError.message);
        } else {
          console.log('✅ Profile fetch successful');
          console.log('- Role:', profile.role);
          console.log('- Email:', profile.email);
        }
      } catch (err) {
        console.log('❌ Profile fetch error:', err.message);
      }
      console.log('');
    }

    // Test 4: Auth listener test
    console.log('🧪 Test 4: Auth Listener');
    let listenerCalled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('📡 Auth event:', event, session ? 'with session' : 'without session');
      listenerCalled = true;
    });

    setTimeout(() => {
      subscription.unsubscribe();
      console.log(listenerCalled ? '✅ Listener working' : '⚠️  No events received');
      
      console.log('\n📊 Diagnosis:');
      console.log('1. If user_profiles table is missing, that\'s the main issue');
      console.log('2. If RLS policies are too restrictive, users can\'t read their profiles');
      console.log('3. If session exists but profile fetch fails, check RLS policies');
      console.log('4. The "Checking authentication..." loop happens when profile fetch fails');
      
      console.log('\n🔧 Potential Fixes:');
      console.log('1. Create user_profiles table if missing');
      console.log('2. Add RLS policy: CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);');
      console.log('3. Ensure user has a profile record after signup');
      console.log('4. Check for network/timeout issues');
      
      process.exit(0);
    }, 1500);

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

debugAuth().catch(console.error);