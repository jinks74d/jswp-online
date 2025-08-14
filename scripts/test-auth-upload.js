/**
 * Script to test logo upload with proper authentication
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testAuthUpload() {
  console.log('🔐 Testing authenticated logo upload...\n');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  // Use the anon client like the browser would
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Check if we can access the bucket without authentication
    console.log('📦 Testing bucket access with anon client...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
    } else {
      console.log('✅ Anon client can see buckets:', buckets.map(b => b.id));
    }

    // Test file listing
    console.log('\n📁 Testing file listing with anon client...');
    const { data: files, error: listError } = await supabase.storage
      .from('district-logos')
      .list();

    if (listError) {
      console.error('❌ Error listing files:', listError.message);
    } else {
      console.log(`✅ Can list files (${files.length} files found)`);
    }

    // Test upload without authentication (should fail)
    console.log('\n📤 Testing upload without authentication...');
    const testDistrictId = '12345678-1234-1234-1234-123456789abc';
    const testFileName = `district-${testDistrictId}/logo.png`;
    
    // Create a minimal PNG file content
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x01, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('district-logos')
      .upload(testFileName, pngData, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.log('❌ Upload failed (expected without auth):', uploadError.message);
      
      // Check if this is a policy/RLS issue
      if (uploadError.message.includes('policy') || uploadError.message.includes('RLS') || uploadError.message.includes('permission')) {
        console.log('   This suggests RLS policies are active and working');
      }
    } else {
      console.log('⚠️  Upload succeeded without authentication - this might be a security issue!');
    }

    // Let's check what user_profiles exist and try to authenticate
    console.log('\n👤 Checking available users...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .eq('role', 'super_admin')
      .limit(5);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
      
      // Try checking auth users instead
      console.log('\n🔍 Checking auth.users table...');
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.log('❌ Cannot access auth users:', authError.message);
      } else {
        console.log(`✅ Found ${authUsers.users.length} auth users`);
        authUsers.users.forEach(user => {
          console.log(`   - ${user.email} (${user.id})`);
        });
      }
    } else {
      console.log('✅ Super admin profiles found:');
      profiles.forEach(profile => {
        console.log(`   - ${profile.email} (${profile.role})`);
      });
    }

    // The issue might be that the bucket policies haven't been set up
    // Let's check what happens if we make this a public upload bucket temporarily
    console.log('\n⚠️  DIAGNOSIS:');
    console.log('   The upload is likely failing because:');
    console.log('   1. RLS policies are not set up correctly');
    console.log('   2. The user is not authenticated as super_admin');
    console.log('   3. The bucket policies require authentication');
    console.log('\n💡 SOLUTION SUGGESTIONS:');
    console.log('   1. Check if RLS policies exist for storage.objects');
    console.log('   2. Ensure the user uploading has super_admin role');
    console.log('   3. Consider making uploads work without strict policies for now');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Execute the test
testAuthUpload().catch(console.error);