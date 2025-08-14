/**
 * Script to debug storage bucket issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugStorage() {
  console.log('🔍 Debugging storage configuration...\n');

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Create both anon and service role clients
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const serviceClient = createClient(
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
    console.log('📦 Checking buckets with anon client...');
    const { data: anonBuckets, error: anonError } = await anonClient.storage.listBuckets();
    
    if (anonError) {
      console.log('❌ Anon client error:', anonError.message);
    } else {
      console.log('✅ Anon client buckets:', anonBuckets.map(b => `${b.id} (public: ${b.public})`));
    }

    console.log('\n📦 Checking buckets with service client...');
    const { data: serviceBuckets, error: serviceError } = await serviceClient.storage.listBuckets();
    
    if (serviceError) {
      console.log('❌ Service client error:', serviceError.message);
    } else {
      console.log('✅ Service client buckets:', serviceBuckets.map(b => `${b.id} (public: ${b.public})`));
    }

    // Try to create the bucket if it doesn't exist
    const bucketExists = serviceBuckets?.find(b => b.id === 'district-logos');
    
    if (!bucketExists) {
      console.log('\n🔧 Creating district-logos bucket...');
      const { data: newBucket, error: createError } = await serviceClient.storage
        .createBucket('district-logos', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png', 
            'image/webp',
            'image/svg+xml'
          ]
        });

      if (createError) {
        console.log('❌ Create bucket error:', createError.message);
      } else {
        console.log('✅ Bucket created successfully');
      }
    } else {
      console.log('\n✅ district-logos bucket exists');
      console.log(`   - Public: ${bucketExists.public}`);
      console.log(`   - File size limit: ${bucketExists.file_size_limit}`);
      
      if (!bucketExists.public) {
        console.log('\n🔧 Making bucket public...');
        const { error: updateError } = await serviceClient.storage
          .updateBucket('district-logos', { public: true });
        
        if (updateError) {
          console.log('❌ Update bucket error:', updateError.message);
        } else {
          console.log('✅ Bucket made public');
        }
      }
    }

    // Test file operations
    console.log('\n🧪 Testing file operations...');
    
    // Test listing files
    const { data: files, error: listError } = await serviceClient.storage
      .from('district-logos')
      .list();

    if (listError) {
      console.log('❌ List files error:', listError.message);
    } else {
      console.log(`✅ Can list files (${files.length} files found)`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Execute the debug
debugStorage().catch(console.error);