#!/usr/bin/env node

// Test profile fetching with authenticated client (simulating the app)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create client exactly like the app does
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthenticatedProfile() {
  console.log('🔍 Testing authenticated profile fetch...');
  
  const testUserId = '5a6ab155-7c8a-4ffa-90ef-902ca1b102be';
  
  try {
    // First check if we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('🚫 No active session - simulating authenticated request anyway');
    } else {
      console.log('✅ Active session found for:', session.user.id);
    }

    // Test the exact query the app uses
    console.log('\n🧪 Testing profile query (same as AuthProvider)...');
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(`
        *,
        districts:district_id(id, name, domain, primary_color, secondary_color),
        schools:school_id(id, name)
      `)
      .eq("id", testUserId)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError);
      console.log('🔍 Error details:');
      console.log('  - Code:', profileError.code);
      console.log('  - Message:', profileError.message);
      console.log('  - Details:', profileError.details);
      console.log('  - Hint:', profileError.hint);
      
      if (profileError.code === '42501') {
        console.log('\n💡 Error 42501 = insufficient_privilege');
        console.log('   This means RLS is blocking the query');
        console.log('   The authenticated user cannot read this profile');
      }
      
      if (profileError.code === 'PGRST116') {
        console.log('\n💡 Error PGRST116 = no rows returned');
        console.log('   This might mean the profile query succeeded but returned no data');
      }
      
      // Test simpler query
      console.log('\n🧪 Testing simpler query without joins...');
      const { data: simpleProfile, error: simpleError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", testUserId)
        .single();
        
      if (simpleError) {
        console.error('❌ Simple query also failed:', simpleError.message);
      } else {
        console.log('✅ Simple query worked:', simpleProfile?.email);
        
        // Test districts query separately
        console.log('\n🧪 Testing districts query...');
        const { data: district, error: districtError } = await supabase
          .from("districts")
          .select("id, name, domain, primary_color, secondary_color")
          .eq("id", simpleProfile.district_id)
          .single();
          
        if (districtError) {
          console.error('❌ Districts query failed:', districtError.message);
        } else {
          console.log('✅ Districts query worked:', district?.name);
        }
      }
      
    } else {
      console.log('✅ Profile query successful!');
      console.log('📊 Profile data:', {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        district: profile.districts?.name,
        school: profile.schools?.name
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAuthenticatedProfile();