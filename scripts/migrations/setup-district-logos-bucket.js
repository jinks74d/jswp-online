// scripts/setup-district-logos-bucket.js
// This script sets up the district-logos storage bucket in Supabase

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDistrictLogosStorage() {
  console.log('🔧 Setting up district-logos storage bucket...');

  try {
    // Step 1: Check if bucket already exists
    console.log('📋 Checking existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    console.log(`📦 Found ${buckets?.length || 0} existing buckets:`, buckets?.map(b => b.name) || []);

    const existingBucket = buckets?.find(bucket => bucket.name === 'district-logos');
    
    if (existingBucket) {
      console.log('✅ district-logos bucket already exists');
    } else {
      // Step 2: Create the district-logos bucket
      console.log('🆕 Creating district-logos bucket...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('district-logos', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/jpg',
          'image/png', 
          'image/webp',
          'image/svg+xml'
        ]
      });

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log('✅ district-logos bucket created successfully');
    }

    // Step 3: Test bucket access
    console.log('🧪 Testing bucket access...');
    const { data: testFiles, error: testError } = await supabase.storage
      .from('district-logos')
      .list('', { limit: 1 });

    if (testError) {
      console.warn('⚠️  Bucket access test failed:', testError.message);
    } else {
      console.log('✅ Bucket access test successful');
    }

    // Step 4: Apply RLS policies (this requires the SQL to be run separately)
    console.log('📋 Note: RLS policies need to be applied via SQL migration');
    console.log('   Run: migrations/district-logos-storage-setup.sql');

    console.log('🎉 District logos storage setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Apply the RLS policies by running the migration file');
    console.log('2. Upload district logos via the super admin interface');
    console.log('3. District logos will be available at:');
    console.log('   /api/districts/{district-id}/logo');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupDistrictLogosStorage();
