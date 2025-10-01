/**
 * Script to check existing districts for testing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDistricts() {
  console.log('🏫 Checking existing districts...\n');

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
    // Get all districts
    const { data: districts, error: districtsError } = await supabase
      .from('districts')
      .select('*')
      .order('created_at', { ascending: false });

    if (districtsError) {
      console.error('❌ Error fetching districts:', districtsError.message);
      return;
    }

    console.log(`✅ Found ${districts.length} districts:`);
    console.log('');

    districts.forEach((district, index) => {
      console.log(`${index + 1}. ${district.name}`);
      console.log(`   ID: ${district.id}`);
      console.log(`   Domain: ${district.domain || 'None'}`);
      console.log(`   POC Email: ${district.poc_email}`);
      console.log(`   Logo URL: ${district.logo_url || 'None'}`);
      console.log(`   Primary Color: ${district.primary_color || 'None'}`);
      console.log(`   Secondary Color: ${district.secondary_color || 'None'}`);
      console.log(`   Created: ${district.created_at}`);
      console.log('');
    });

    if (districts.length > 0) {
      console.log('💡 You can test logo upload with any of these district IDs');
      console.log('   Navigate to: /super-admin/districts/[district-id]/edit');
      console.log('   Or use the API: /api/districts/[district-id]/upload-logo');
    } else {
      console.log('⚠️  No districts found. Create one first to test logo upload.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Execute the check
checkDistricts().catch(console.error);