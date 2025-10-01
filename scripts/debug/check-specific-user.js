#!/usr/bin/env node

// Check specific user profile
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
  const userId = '5a6ab155-7c8a-4ffa-90ef-902ca1b102be';
  
  console.log('🔍 Checking user profile for:', userId);

  try {
    // Check if user exists in user_profiles table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
      
      if (profileError.code === 'PGRST116') {
        console.log('💡 User profile does not exist in database');
        
        // Check auth.users table
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          console.error('❌ Error checking auth users:', authError);
        } else {
          const authUser = authUsers.users.find(u => u.id === userId);
          if (authUser) {
            console.log('✅ User exists in auth.users:', authUser.email);
            console.log('🔧 Need to create profile in user_profiles table');
          } else {
            console.log('❌ User does not exist in auth.users either');
          }
        }
      }
    } else {
      console.log('✅ User profile found:', profile);
      
      // Test the exact query used by the app
      console.log('\n🧪 Testing app query...');
      const { data: appData, error: appError } = await supabase
        .from("user_profiles")
        .select(`
          *,
          districts:district_id(id, name, domain, primary_color, secondary_color),
          schools:school_id(id, name)
        `)
        .eq("id", userId)
        .single();

      if (appError) {
        console.error('❌ App query failed:', appError);
      } else {
        console.log('✅ App query successful:', {
          id: appData.id,
          email: appData.email,
          role: appData.role,
          district: appData.districts?.name,
          school: appData.schools?.name
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkUser();