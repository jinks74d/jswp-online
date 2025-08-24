#!/usr/bin/env node

/**
 * Test Supabase Connection
 * Run this script to verify your Supabase configuration is working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Check environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    process.exit(1);
  }

  if (!key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    process.exit(1);
  }

  if (key === 'YOUR_REAL_SUPABASE_ANON_KEY_HERE') {
    console.error('❌ You need to replace YOUR_REAL_SUPABASE_ANON_KEY_HERE with your actual Supabase API key');
    console.log('\n📋 Instructions:');
    console.log('1. Go to: https://supabase.com/dashboard/project/zyivphqxqmbslxcrzbnh/settings/api');
    console.log('2. Copy the "anon public" key');
    console.log('3. Replace YOUR_REAL_SUPABASE_ANON_KEY_HERE in .env.local with that key');
    console.log('4. Run this test again\n');
    process.exit(1);
  }

  if (key.endsWith('.placeholder')) {
    console.error('❌ API key still has placeholder value');
    console.log('Please replace with your real Supabase API key\n');
    process.exit(1);
  }

  console.log('✅ Environment variables found:');
  console.log(`   URL: ${url}`);
  console.log(`   Key: ${key.substring(0, 20)}...${key.substring(key.length - 10)}\n`);

  // Create Supabase client
  let supabase;
  try {
    supabase = createClient(url, key);
    console.log('✅ Supabase client created successfully\n');
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error.message);
    process.exit(1);
  }

  // Test basic connection
  try {
    console.log('🔄 Testing database connection...');
    
    // Simple query to test connection
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) {
      if (error.message.includes('Invalid API key')) {
        console.error('❌ Invalid API key - please check your NEXT_PUBLIC_SUPABASE_ANON_KEY');
        console.log('\nMake sure you copied the "anon public" key from:');
        console.log('https://supabase.com/dashboard/project/zyivphqxqmbslxcrzbnh/settings/api\n');
      } else {
        console.error('❌ Database connection failed:', error.message);
      }
      process.exit(1);
    }

    console.log('✅ Database connection successful!');
    console.log('✅ Authentication system should now work properly\n');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }

  console.log('🎉 All tests passed! Your Supabase configuration is working correctly.');
  console.log('\nYou can now:');
  console.log('1. Start your development server: npm run dev');
  console.log('2. Try logging in at http://localhost:3000/login');
  console.log('3. Delete this test file if you want: rm test-supabase-connection.js\n');
}

testConnection().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});