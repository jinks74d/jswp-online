/**
 * Script to test logo upload functionality
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function testUpload() {
  console.log('🧪 Testing logo upload functionality...\n');

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
    // First, let's check if we can see the bucket
    console.log('📦 Checking bucket accessibility...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    const bucket = buckets.find(b => b.id === 'district-logos');
    if (!bucket) {
      console.error('❌ district-logos bucket not found');
      return;
    }

    console.log('✅ Bucket found:', {
      id: bucket.id,
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit
    });

    // Test file listing
    console.log('\n📁 Testing file listing...');
    const { data: files, error: listError } = await supabase.storage
      .from('district-logos')
      .list();

    if (listError) {
      console.error('❌ Error listing files:', listError.message);
    } else {
      console.log(`✅ Can list files (${files.length} files found)`);
    }

    // Test creating a test upload
    console.log('\n📤 Testing file upload...');
    const testDistrictId = '12345678-1234-1234-1234-123456789abc';
    const testFileName = `district-${testDistrictId}/logo.png`;
    
    // Create a minimal PNG file content (1x1 transparent pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x01, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    console.log(`   Uploading to: ${testFileName}`);
    console.log(`   File size: ${pngData.length} bytes`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('district-logos')
      .upload(testFileName, pngData, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError.message);
      console.error('   Error details:', uploadError);
    } else {
      console.log('✅ Upload successful!');
      console.log('   Path:', uploadData.path);
      console.log('   ID:', uploadData.id);
    }

    // Test download/access
    if (!uploadError) {
      console.log('\n📥 Testing file download...');
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('district-logos')
        .download(testFileName);

      if (downloadError) {
        console.error('❌ Download error:', downloadError.message);
      } else {
        console.log('✅ Download successful!');
        console.log('   File size:', downloadData.size);
        console.log('   File type:', downloadData.type);
      }

      // Test public URL
      console.log('\n🌐 Testing public URL...');
      const { data: publicURL } = supabase.storage
        .from('district-logos')
        .getPublicUrl(testFileName);

      console.log('✅ Public URL generated:', publicURL.publicUrl);

      // Cleanup test file
      console.log('\n🧹 Cleaning up test file...');
      const { error: deleteError } = await supabase.storage
        .from('district-logos')
        .remove([testFileName]);

      if (deleteError) {
        console.error('❌ Delete error:', deleteError.message);
      } else {
        console.log('✅ Test file deleted');
      }
    }

    // Test the API route that serves logos
    console.log('\n🌐 Testing logo serving API...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('supabase.co', 'supabase.co')}/api/districts/${testDistrictId}/logo`);
      console.log(`   API response status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ API route accessible');
      } else {
        const errorText = await response.text();
        console.log(`⚠️  API route returned ${response.status}: ${errorText}`);
      }
    } catch (fetchError) {
      console.log('⚠️  Could not test API route:', fetchError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Execute the test
testUpload().catch(console.error);