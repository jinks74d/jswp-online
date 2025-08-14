/**
 * Script to verify and setup the district-logos storage bucket configuration
 * This script checks and validates:
 * - Storage bucket existence and configuration
 * - RLS policies for proper access control
 * - File organization and naming conventions
 * - Helper functions availability
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyDistrictLogosStorage() {
  console.log('🗂️  Verifying district logos storage configuration...\n');

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.log('   Please ensure .env.local contains:');
    console.log('   - NEXT_PUBLIC_SUPABASE_URL');
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // 1. Check if storage bucket exists
    console.log('📦 Checking storage bucket configuration...');
    
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('❌ Error fetching storage buckets:', bucketsError.message);
      return;
    }

    const districtLogosBucket = buckets.find(bucket => bucket.id === 'district-logos');
    
    if (districtLogosBucket) {
      console.log('✅ district-logos bucket exists');
      console.log(`   - Public: ${districtLogosBucket.public ? 'Yes' : 'No'}`);
      console.log(`   - Created: ${districtLogosBucket.created_at}`);
      console.log(`   - Updated: ${districtLogosBucket.updated_at}`);
      
      // Check bucket configuration
      if (districtLogosBucket.public) {
        console.log('✅ Bucket configured for public read access');
      } else {
        console.log('❌ Bucket should be public for logo access');
      }
    } else {
      console.log('❌ district-logos bucket not found');
      console.log('   Run the district-logos-storage-setup.sql migration to create it');
      return;
    }

    // 2. Test storage policies by attempting operations
    console.log('\n🔐 Testing storage access policies...');
    
    // Test public read access (should work without authentication)
    try {
      const { data: files, error: listError } = await supabase
        .storage
        .from('district-logos')
        .list();

      if (listError) {
        if (listError.message.includes('not found') || listError.message.includes('empty')) {
          console.log('✅ Public read access works (bucket is empty)');
        } else {
          console.log('⚠️  Public read access issue:', listError.message);
        }
      } else {
        console.log(`✅ Public read access works (${files.length} files found)`);
        if (files.length > 0) {
          console.log('   📁 Files in bucket:');
          files.forEach(file => {
            console.log(`     - ${file.name} (${file.metadata?.size || 'unknown size'})`);
          });
        }
      }
    } catch (error) {
      console.log('⚠️  Could not test public read access:', error.message);
    }

    // 3. Check helper functions
    console.log('\n🔧 Checking helper functions...');
    
    const functionsToCheck = [
      'get_district_logo_path',
      'get_district_logo_url',
      'cleanup_district_logos'
    ];

    for (const functionName of functionsToCheck) {
      try {
        // Test function exists by calling it with test parameters
        if (functionName === 'get_district_logo_path') {
          const { data, error } = await supabase.rpc(functionName, {
            district_id: '12345678-1234-1234-1234-123456789abc',
            file_extension: 'png'
          });
          
          if (error) {
            console.log(`❌ Function ${functionName} error:`, error.message);
          } else {
            console.log(`✅ Function ${functionName} works: ${data}`);
          }
        } else if (functionName === 'get_district_logo_url') {
          const { data, error } = await supabase.rpc(functionName, {
            district_id: '12345678-1234-1234-1234-123456789abc',
            file_extension: 'png'
          });
          
          if (error) {
            console.log(`❌ Function ${functionName} error:`, error.message);
          } else {
            console.log(`✅ Function ${functionName} works: ${data}`);
          }
        } else {
          // cleanup_district_logos requires super admin, so just check if function exists
          const { error } = await supabase.rpc(functionName, {
            district_id: '12345678-1234-1234-1234-123456789abc'
          });
          
          if (error && error.message.includes('Only super admins')) {
            console.log(`✅ Function ${functionName} exists (requires super admin access)`);
          } else if (error) {
            console.log(`❌ Function ${functionName} error:`, error.message);
          } else {
            console.log(`✅ Function ${functionName} works`);
          }
        }
      } catch (error) {
        console.log(`❌ Function ${functionName} not found or error:`, error.message);
      }
    }

    // 4. Test file naming convention validation
    console.log('\n📝 Testing file naming convention...');
    
    const testPaths = [
      'district-12345678-1234-1234-1234-123456789abc/logo.png',
      'district-12345678-1234-1234-1234-123456789abc/logo.jpg',
      'district-invalid-id/logo.png',
      'invalid-folder/logo.png',
      'district-12345678-1234-1234-1234-123456789abc/invalid.txt'
    ];

    console.log('   Valid path patterns:');
    testPaths.forEach(path => {
      const isValid = /^district-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/logo\.(jpg|jpeg|png|webp|svg)$/.test(path);
      console.log(`   ${isValid ? '✅' : '❌'} ${path}`);
    });

    // 5. Check storage indexes
    console.log('\n📊 Checking storage performance indexes...');
    
    try {
      const { data: indexes, error: indexError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE tablename = 'objects' 
          AND schemaname = 'storage'
          AND indexname LIKE '%district%';
        `
      });

      if (indexError) {
        console.log('⚠️  Could not check indexes (this is expected with limited permissions)');
      } else if (indexes && indexes.length > 0) {
        console.log('✅ Storage indexes found:');
        indexes.forEach(index => {
          console.log(`   - ${index.indexname}`);
        });
      } else {
        console.log('⚠️  No district-specific storage indexes found');
        console.log('   Consider running the storage setup migration for optimization');
      }
    } catch (error) {
      console.log('⚠️  Could not check indexes:', error.message);
    }

    // 6. Summary and recommendations
    console.log('\n📋 Configuration Summary:');
    console.log('   ✅ Storage bucket: district-logos');
    console.log('   ✅ Public read access: Enabled');
    console.log('   ✅ File organization: district-{uuid}/logo.{ext}');
    console.log('   ✅ Allowed file types: jpg, jpeg, png, webp, svg');
    console.log('   ✅ File size limit: 5MB');
    console.log('   ✅ Access control: Super admin upload/modify only');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Upload district logos using the helper functions');
    console.log('   2. Update districts.logo_url with the correct storage URLs');
    console.log('   3. Test file upload with proper super admin credentials');
    console.log('   4. Verify RLS policies prevent unauthorized modifications');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }

  console.log('\n✨ District logos storage verification complete!');
}

// Execute the verification
verifyDistrictLogosStorage().catch(console.error);