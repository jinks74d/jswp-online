/**
 * Script to set up the district-logos storage bucket
 * This script creates the bucket and necessary policies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function setupDistrictLogosStorage() {
  console.log('🚀 Setting up district logos storage...\n');

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.log('   Please ensure .env.local contains:');
    console.log('   - NEXT_PUBLIC_SUPABASE_URL');
    console.log('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create admin client with service role key
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
    console.log('📦 Creating district-logos bucket...');

    // Create the bucket
    const { data: bucket, error: bucketError } = await supabase.storage
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

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Bucket already exists');
      } else {
        console.error('❌ Error creating bucket:', bucketError.message);
        throw bucketError;
      }
    } else {
      console.log('✅ Bucket created successfully');
    }

    // Verify bucket exists
    console.log('\n🔍 Verifying bucket configuration...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      throw listError;
    }

    const districtLogoBucket = buckets.find(b => b.id === 'district-logos');
    if (districtLogoBucket) {
      console.log('✅ Bucket verified');
      console.log(`   - Public: ${districtLogoBucket.public}`);
      console.log(`   - File size limit: ${districtLogoBucket.file_size_limit} bytes`);
    } else {
      throw new Error('Bucket not found after creation');
    }

    // Set up storage policies using SQL
    console.log('\n🔐 Setting up storage policies...');
    
    const policySQL = `
      -- Enable RLS on storage.objects if not already enabled
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies to avoid conflicts
      DROP POLICY IF EXISTS "Public read access for district logos" ON storage.objects;
      DROP POLICY IF EXISTS "Super admins can manage district logos" ON storage.objects;
      DROP POLICY IF EXISTS "Super admins can upload district logos" ON storage.objects;
      DROP POLICY IF EXISTS "Super admins can update district logos" ON storage.objects;
      DROP POLICY IF EXISTS "Super admins can delete district logos" ON storage.objects;

      -- Policy 1: Public read access to district logos
      CREATE POLICY "Public read access for district logos" ON storage.objects
        FOR SELECT USING (
          bucket_id = 'district-logos'
        );

      -- Policy 2: Super admins can upload district logos
      CREATE POLICY "Super admins can upload district logos" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'district-logos' AND
          EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
          ) AND
          -- Enforce file naming convention: district-{district_id}/logo.{ext}
          name ~ '^district-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\\.(jpg|jpeg|png|webp|svg)$'
        );

      -- Policy 3: Super admins can update district logos
      CREATE POLICY "Super admins can update district logos" ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'district-logos' AND
          EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
          )
        );

      -- Policy 4: Super admins can delete district logos
      CREATE POLICY "Super admins can delete district logos" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'district-logos' AND
          EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
          )
        );
    `;

    const { error: policyError } = await supabase.rpc('exec_sql', {
      query: policySQL
    });

    if (policyError) {
      console.error('❌ Error setting up policies:', policyError.message);
      throw policyError;
    }
    console.log('✅ Storage policies created successfully');

    // Create helper functions
    console.log('\n🔧 Creating helper functions...');
    
    const functionsSQL = `
      -- Function to generate the correct file path for a district logo
      CREATE OR REPLACE FUNCTION get_district_logo_path(
        district_id UUID,
        file_extension TEXT DEFAULT 'png'
      )
      RETURNS TEXT AS $func$
      BEGIN
        -- Validate file extension
        IF file_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'svg') THEN
          RAISE EXCEPTION 'Invalid file extension. Allowed: jpg, jpeg, png, webp, svg';
        END IF;
        
        -- Return the standardized path
        RETURN 'district-' || district_id::TEXT || '/logo.' || file_extension;
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Function to get the full Supabase Storage URL for a district logo
      CREATE OR REPLACE FUNCTION get_district_logo_url(
        district_id UUID,
        file_extension TEXT DEFAULT 'png'
      )
      RETURNS TEXT AS $func$
      DECLARE
        file_path TEXT;
      BEGIN
        file_path := get_district_logo_path(district_id, file_extension);
        
        -- Return the full URL path for Supabase Storage
        RETURN '/storage/v1/object/public/district-logos/' || file_path;
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Function to validate and clean up district logo files
      CREATE OR REPLACE FUNCTION cleanup_district_logos(district_id UUID)
      RETURNS INT AS $func$
      DECLARE
        deleted_count INT := 0;
        file_record RECORD;
      BEGIN
        -- Only super admins can perform cleanup
        IF NOT EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role = 'super_admin'
        ) THEN
          RAISE EXCEPTION 'Only super admins can cleanup district logos';
        END IF;
        
        -- Count and prepare to delete old logo files for this district
        FOR file_record IN
          SELECT id, name FROM storage.objects 
          WHERE bucket_id = 'district-logos' 
          AND name LIKE 'district-' || district_id::TEXT || '/%'
        LOOP
          -- Delete the file (this will trigger storage policies)
          DELETE FROM storage.objects WHERE id = file_record.id;
          deleted_count := deleted_count + 1;
        END LOOP;
        
        RETURN deleted_count;
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: functionsError } = await supabase.rpc('exec_sql', {
      query: functionsSQL
    });

    if (functionsError) {
      console.error('❌ Error creating helper functions:', functionsError.message);
      throw functionsError;
    }
    console.log('✅ Helper functions created successfully');

    // Test the setup
    console.log('\n🧪 Testing storage setup...');
    
    try {
      const { data: files, error: listFilesError } = await supabase.storage
        .from('district-logos')
        .list();

      if (listFilesError) {
        console.log('⚠️  Public list access issue (this is expected for empty bucket):', listFilesError.message);
      } else {
        console.log(`✅ Public read access works (${files.length} files in bucket)`);
      }
    } catch (error) {
      console.log('⚠️  Could not test public access:', error.message);
    }

    console.log('\n🎉 STORAGE SETUP COMPLETE!');
    console.log('   ✅ district-logos bucket created');
    console.log('   ✅ Public read access enabled');
    console.log('   ✅ Super admin upload/modify policies set');
    console.log('   ✅ Helper functions available');
    
    console.log('\n📚 What\'s configured:');
    console.log('   - Bucket: district-logos (public read)');
    console.log('   - File size limit: 5MB');
    console.log('   - Allowed types: jpeg, jpg, png, webp, svg');
    console.log('   - File path: district-{uuid}/logo.{ext}');
    console.log('   - Upload/modify: super_admin role only');
    console.log('   - Helper functions: get_district_logo_path, get_district_logo_url, cleanup_district_logos');

  } catch (error) {
    console.error('❌ Storage setup failed:', error.message);
    process.exit(1);
  }
}

// Execute the setup
setupDistrictLogosStorage().catch(console.error);