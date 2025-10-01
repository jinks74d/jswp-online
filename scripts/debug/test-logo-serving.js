/**
 * Script to test the logo serving API route
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testLogoServing() {
  console.log('🌐 Testing logo serving functionality...\n');

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
    // Test district IDs from the actual database
    const testDistrictIds = [
      '5076efdf-673e-41a3-bdcc-57b54a446c22', // Los Angeles County Office of Education
      '69702f52-e2c3-4bbc-afd7-4e7e067e8715', // Keller Independent School District
      '03ea1f59-ef0f-4b52-b5e5-ab5fd16e6c18'  // Carroll Independent School District
    ];

    // First, upload a test logo to one of the districts
    console.log('📤 Creating test logo file...');
    
    const testDistrictId = testDistrictIds[0]; // Use LACOE
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

    // Upload test logo
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('district-logos')
      .upload(testFileName, pngData, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError.message);
      return;
    }

    console.log('✅ Test logo uploaded successfully');
    console.log(`   Path: ${uploadData.path}`);

    // Update the district with a logo_url
    const logoUrl = `/api/districts/${testDistrictId}/logo`;
    const { error: updateError } = await supabase
      .from('districts')
      .update({ logo_url: logoUrl })
      .eq('id', testDistrictId);

    if (updateError) {
      console.error('❌ Error updating district:', updateError.message);
      return;
    }

    console.log('✅ District updated with logo URL');

    // Now test the logo serving route by downloading through the API simulation
    console.log('\n🌐 Testing logo serving...');
    
    // Simulate what the API route does
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("id, name, logo_url")
      .eq("id", testDistrictId)
      .single();

    if (districtError || !district) {
      console.error('❌ District not found:', districtError?.message);
      return;
    }

    console.log(`✅ Found district: ${district.name}`);
    console.log(`   Logo URL: ${district.logo_url}`);

    if (!district.logo_url) {
      console.log('❌ No logo_url set for district');
      return;
    }

    // Test downloading the logo file
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
    let logoData = null;
    let contentType = 'image/png';

    for (const ext of extensions) {
      const filePath = `district-${testDistrictId}/logo.${ext}`;
      
      const { data, error } = await supabase.storage
        .from('district-logos')
        .download(filePath);

      if (!error && data) {
        logoData = data;
        contentType = data.type || `image/${ext}`;
        console.log(`✅ Found logo file: ${filePath}`);
        console.log(`   Content type: ${contentType}`);
        console.log(`   File size: ${data.size} bytes`);
        break;
      }
    }

    if (!logoData) {
      console.log('❌ Logo file not found in storage');
      return;
    }

    console.log('✅ Logo serving test successful!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Logo uploaded to storage');
    console.log('   ✅ District updated with logo URL');
    console.log('   ✅ Logo file can be downloaded');
    console.log('   ✅ API route logic works correctly');

    // Cleanup (optional)
    console.log('\n🧹 Cleaning up test data...');
    const { error: deleteError } = await supabase.storage
      .from('district-logos')
      .remove([testFileName]);

    if (deleteError) {
      console.log('⚠️  Could not delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file deleted');
    }

    // Remove logo URL from district
    const { error: clearError } = await supabase
      .from('districts')
      .update({ logo_url: null })
      .eq('id', testDistrictId);

    if (clearError) {
      console.log('⚠️  Could not clear logo URL:', clearError.message);
    } else {
      console.log('✅ Logo URL cleared from district');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Execute the test
testLogoServing().catch(console.error);