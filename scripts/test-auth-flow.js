#!/usr/bin/env node

// Test the actual authentication flow
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create client exactly like the app does
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthFlow() {
  console.log('🔍 Testing authentication flow...');

  try {
    // Check current session
    console.log('📋 Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Error getting session:', sessionError);
      return;
    }

    if (!session) {
      console.log('🚫 No active session found');
      console.log('💡 Please log in through the web app first, then run this script again');
      return;
    }

    console.log('✅ Active session found for user:', session.user.id);

    // Test profile fetching with the exact same query as the app
    console.log('\n🧪 Testing profile fetch...');
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(`
        *,
        districts:district_id(id, name, domain, primary_color, secondary_color),
        schools:school_id(id, name)
      `)
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      console.log('🔍 Error details:');
      console.log('  - Code:', profileError.code);
      console.log('  - Message:', profileError.message);
      console.log('  - Details:', profileError.details);
      console.log('  - Hint:', profileError.hint);
      
      if (profileError.code === 'PGRST116') {
        console.log('\n💡 PGRST116 means "The result contains 0 rows"');
        console.log('   This suggests the user profile does not exist in the database');
        
        // Check if user exists at all
        console.log('\n🔍 Checking if user exists in user_profiles...');
        const { data: allProfiles, error: allError } = await supabase
          .from("user_profiles")
          .select("id, email, role")
          .eq("id", session.user.id);
          
        if (allError) {
          console.error('❌ Error checking user existence:', allError);
        } else if (allProfiles && allProfiles.length === 0) {
          console.log('❌ User profile does not exist in database!');
          console.log('🔧 You need to create a profile for this user');
        } else {
          console.log('✅ User profile exists:', allProfiles[0]);
        }
      }
    } else {
      console.log('✅ Profile fetched successfully!');
      console.log('📊 Profile data:');
      console.log('  - ID:', profile.id);
      console.log('  - Role:', profile.role);
      console.log('  - Email:', profile.email);
      console.log('  - District:', profile.districts?.name || 'None');
      console.log('  - School:', profile.schools?.name || 'None');
    }

    // Test auth state change listener
    console.log('\n🎧 Testing auth state listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth event:', event, session?.user?.id);
    });

    // Clean up
    setTimeout(() => {
      subscription.unsubscribe();
      console.log('✅ Test completed');
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

testAuthFlow();