/**
 * Script to verify that the districts table has the required branding columns
 * This script checks for: primary_color, secondary_color, and logo_url columns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyDistrictBrandingSchema() {
  console.log('🔍 Verifying district branding schema...\n');

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
    console.log('📊 Checking districts table structure...');
    
    // Query the information_schema to get column information
    const { data: columns, error: schemaError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'districts' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });

    if (schemaError) {
      // Fallback: try to query the table directly to see what columns exist
      console.log('⚠️  Could not access information_schema, trying direct table query...');
      
      const { data: sampleData, error: tableError } = await supabase
        .from('districts')
        .select('*')
        .limit(1);

      if (tableError) {
        console.error('❌ Error accessing districts table:', tableError.message);
        process.exit(1);
      }

      if (sampleData && sampleData.length > 0) {
        console.log('✅ Districts table exists and is accessible');
        console.log('📋 Available columns from sample data:');
        Object.keys(sampleData[0]).forEach(column => {
          console.log(`   - ${column}`);
        });

        // Check for required branding columns
        const requiredColumns = ['primary_color', 'secondary_color', 'logo_url'];
        const existingColumns = Object.keys(sampleData[0]);
        
        console.log('\n🎨 Branding columns status:');
        requiredColumns.forEach(column => {
          const exists = existingColumns.includes(column);
          console.log(`   ${exists ? '✅' : '❌'} ${column}: ${exists ? 'EXISTS' : 'MISSING'}`);
        });

        const allColumnsExist = requiredColumns.every(col => existingColumns.includes(col));
        
        if (allColumnsExist) {
          console.log('\n🎉 SUCCESS: All required branding columns exist!');
          console.log('   Your database is ready for district branding features.');
        } else {
          console.log('\n⚠️  MISSING COLUMNS: Some branding columns are missing.');
          console.log('   Please run the add-district-branding-features.sql migration.');
        }
      } else {
        console.log('✅ Districts table exists but has no data yet');
        console.log('   Unable to verify column structure without sample data');
      }
    } else {
      console.log('✅ Successfully retrieved table schema');
      console.log('\n📋 Districts table columns:');
      
      columns.forEach(column => {
        console.log(`   - ${column.column_name} (${column.data_type}${column.is_nullable === 'YES' ? ', nullable' : ', not null'})`);
      });

      // Check for required branding columns
      const requiredColumns = ['primary_color', 'secondary_color', 'logo_url'];
      const existingColumns = columns.map(col => col.column_name);
      
      console.log('\n🎨 Branding columns status:');
      requiredColumns.forEach(column => {
        const exists = existingColumns.includes(column);
        console.log(`   ${exists ? '✅' : '❌'} ${column}: ${exists ? 'EXISTS' : 'MISSING'}`);
      });

      const allColumnsExist = requiredColumns.every(col => existingColumns.includes(col));
      
      if (allColumnsExist) {
        console.log('\n🎉 SUCCESS: All required branding columns exist!');
        console.log('   Your database is ready for district branding features.');
      } else {
        console.log('\n⚠️  MISSING COLUMNS: Some branding columns are missing.');
        console.log('   Please run the add-district-branding-features.sql migration.');
      }
    }

    // Test basic district query to ensure RLS policies work
    console.log('\n🔐 Testing district access with current authentication...');
    const { data: districts, error: queryError } = await supabase
      .from('districts')
      .select('id, name, primary_color, secondary_color, logo_url')
      .limit(5);

    if (queryError) {
      if (queryError.message.includes('JWT')) {
        console.log('⚠️  Not authenticated - this is expected for schema verification');
        console.log('   RLS policies are working (requires authentication for data access)');
      } else {
        console.log('⚠️  Query error:', queryError.message);
      }
    } else {
      console.log(`✅ Successfully queried districts table (${districts.length} records found)`);
      if (districts.length > 0) {
        console.log('📊 Sample district branding data:');
        districts.forEach(district => {
          console.log(`   - ${district.name}:`);
          console.log(`     Primary Color: ${district.primary_color || 'Not set'}`);
          console.log(`     Secondary Color: ${district.secondary_color || 'Not set'}`);
          console.log(`     Logo URL: ${district.logo_url || 'Not set'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }

  console.log('\n✨ Schema verification complete!');
}

// Execute the verification
verifyDistrictBrandingSchema().catch(console.error);