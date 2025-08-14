#!/usr/bin/env node

// Test script to verify user authentication and RLS policies
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const testUserId = '5a6ab155-7c8a-4ffa-90ef-902ca1b102be';

async function testUserExists() {
  console.log('🔍 Step 1: Verifying user exists...');
  
  const { data: user, error } = await serviceClient
    .from('user_profiles')
    .select('*')
    .eq('id', testUserId)
    .single();

  if (error) {
    console.error('❌ User not found:', error.message);
    return false;
  }

  console.log('✅ User found:', {
    id: user.id,
    email: user.email,
    role: user.role,
    district_id: user.district_id,
    school_id: user.school_id
  });

  return user;
}

async function testProfileQueryWithJoins() {
  console.log('\n🔍 Step 2: Testing profile query with joins (service key)...');
  
  const { data, error } = await serviceClient
    .from('user_profiles')
    .select(`
      *,
      districts:district_id(id, name, domain, primary_color, secondary_color),
      schools:school_id(id, name)
    `)
    .eq('id', testUserId)
    .single();

  if (error) {
    console.error('❌ Profile query failed:', error.message);
    return false;
  }

  console.log('✅ Profile query successful');
  console.log('📊 Profile data:', {
    user_id: data.id,
    email: data.email,
    role: data.role,
    district: data.districts ? {
      id: data.districts.id,
      name: data.districts.name,
      domain: data.districts.domain
    } : null,
    school: data.schools ? {
      id: data.schools.id,
      name: data.schools.name
    } : null
  });

  return true;
}

async function testUnauthenticatedAccess() {
  console.log('\n🔍 Step 3: Testing unauthenticated access (should fail if RLS works)...');
  
  const { data, error } = await anonClient
    .from('user_profiles')
    .select('id, email')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('row-level security')) {
      console.log('✅ RLS is working - unauthenticated access properly blocked');
      console.log('   Error:', error.message);
      return true;
    } else {
      console.log('⚠️ Unexpected error:', error.message);
      return false;
    }
  }

  console.log('❌ RLS might not be working - unauthenticated access allowed');
  console.log('   Found', data?.length || 0, 'profiles');
  return false;
}

async function simulateAuthenticatedQuery() {
  console.log('\n🔍 Step 4: Simulating authenticated user query...');
  console.log('⚠️ Note: This uses service key - actual auth would use user JWT token');
  
  // In a real scenario, this would be done with proper user authentication
  // For now, we can only test the query structure
  
  const { data, error } = await serviceClient
    .from('user_profiles')
    .select(`
      *,
      districts:district_id(id, name, domain, primary_color, secondary_color),
      schools:school_id(id, name)
    `)
    .eq('id', testUserId)
    .single();

  if (error) {
    console.error('❌ Simulated auth query failed:', error.message);
    return false;
  }

  console.log('✅ Query structure is correct and should work with proper auth');
  return true;
}

async function checkTablePermissions() {
  console.log('\n🔍 Step 5: Checking table permissions...');
  
  try {
    // Test each table individually
    const tables = ['user_profiles', 'districts', 'schools'];
    
    for (const table of tables) {
      const { data, error } = await anonClient
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        console.log(`✅ ${table}: Access properly restricted (${error.code})`);
      } else {
        console.log(`⚠️ ${table}: Access allowed - may need RLS policy`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking permissions:', error.message);
  }
}

async function main() {
  console.log('🧪 JSWP Online - User Authentication Test');
  console.log('Testing user: ruiz_daniel@lacoe.edu');
  console.log('User ID: 5a6ab155-7c8a-4ffa-90ef-902ca1b102be');
  console.log('==================================================\n');

  try {
    const user = await testUserExists();
    if (!user) return;

    const profileQueryWorks = await testProfileQueryWithJoins();
    const rlsWorking = await testUnauthenticatedAccess();
    const authQueryWorks = await simulateAuthenticatedQuery();
    
    await checkTablePermissions();

    console.log('\n📊 Test Summary');
    console.log('==================================================');
    console.log(`User exists: ${user ? '✅' : '❌'}`);
    console.log(`Profile query works: ${profileQueryWorks ? '✅' : '❌'}`);
    console.log(`RLS protecting tables: ${rlsWorking ? '✅' : '❌'}`);
    console.log(`Auth query structure: ${authQueryWorks ? '✅' : '❌'}`);

    if (user && profileQueryWorks && authQueryWorks) {
      console.log('\n🎉 User data and queries look good!');
      
      if (!rlsWorking) {
        console.log('\n⚠️ RLS policies need to be applied. Please:');
        console.log('1. Open Supabase Dashboard > SQL Editor');
        console.log('2. Run the SQL commands from RLS_FIX_INSTRUCTIONS.md');
        console.log('3. Test authentication again');
      } else {
        console.log('\n✅ RLS is working. Authentication should work properly.');
      }
    } else {
      console.log('\n❌ Issues found that need to be resolved.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();