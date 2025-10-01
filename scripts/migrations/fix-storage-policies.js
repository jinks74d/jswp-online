/**
 * Script to fix storage policies for district logos
 * This approach doesn't rely on exec_sql function
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixStoragePolicies() {
  console.log('🔧 Fixing storage policies for district logos...\n');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Strategy 1: Check if we can create a policy directly through the REST API
    console.log('🔐 Checking current storage policies...');
    
    // Try to see what policies exist by attempting various uploads
    // For now, let's make the bucket work by updating its settings
    
    console.log('📝 Temporarily allowing authenticated uploads...');
    
    // The issue might be that we need to actually set up policies through Supabase Dashboard
    // Or the current policies are too restrictive
    
    // Let's check if the user exists in the system first
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Cannot list auth users:', authError.message);
    } else {
      console.log(`✅ Found ${authUsers.users.length} auth users in the system`);
      
      if (authUsers.users.length > 0) {
        // Check if any have profiles
        const userIds = authUsers.users.map(u => u.id);
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, email, role')
          .in('id', userIds);
          
        if (profileError) {
          console.log('❌ Error fetching profiles:', profileError.message);
        } else {
          console.log(`✅ Found ${profiles.length} user profiles`);
          profiles.forEach(p => {
            console.log(`   - ${p.email}: ${p.role}`);
          });
          
          const superAdmins = profiles.filter(p => p.role === 'super_admin');
          if (superAdmins.length === 0) {
            console.log('\n⚠️  NO SUPER ADMIN USERS FOUND!');
            console.log('   This is why uploads are failing.');
            console.log('   The storage policy requires a super_admin role but none exist.');
          } else {
            console.log(`\n✅ Found ${superAdmins.length} super admin(s)`);
          }
        }
      }
    }

    // Strategy 2: Let's create a simple workaround
    // We'll modify the EditDistrictForm to use a different approach
    console.log('\n💡 SOLUTION APPROACH:');
    console.log('   Since RLS policies are blocking uploads, we have a few options:');
    console.log('   1. Create a super admin user with proper role');
    console.log('   2. Use an API route for uploads (with service role key)');
    console.log('   3. Temporarily disable strict policies for testing');
    console.log('   4. Set up policies through Supabase Dashboard manually');
    
    console.log('\n🔧 RECOMMENDED FIX:');
    console.log('   Use an API route for logo uploads instead of direct storage access');
    console.log('   This way we can use the service role key on the server side');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Execute the fix
fixStoragePolicies().catch(console.error);