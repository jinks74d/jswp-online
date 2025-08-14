/**
 * Simple script to add missing district branding columns
 * Uses direct SQL execution via Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function addBrandingColumns() {
  console.log('🚀 Adding district branding columns...\n');

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
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
    console.log('🔧 Adding primary_color column...');
    const { error: primaryColorError } = await supabase
      .rpc('exec', {
        query: 'ALTER TABLE districts ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);'
      });

    if (primaryColorError) {
      console.log('⚠️  Primary color column may already exist or exec function not available');
      console.log('   Error:', primaryColorError.message);
    } else {
      console.log('✅ Primary color column added');
    }

    console.log('🔧 Adding secondary_color column...');
    const { error: secondaryColorError } = await supabase
      .rpc('exec', {
        query: 'ALTER TABLE districts ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);'
      });

    if (secondaryColorError) {
      console.log('⚠️  Secondary color column may already exist or exec function not available');
      console.log('   Error:', secondaryColorError.message);
    } else {
      console.log('✅ Secondary color column added');
    }

    // Test if columns exist by trying to query them
    console.log('\n🔍 Testing column accessibility...');
    const { data, error: testError } = await supabase
      .from('districts')
      .select('id, name, primary_color, secondary_color')
      .limit(1);

    if (testError) {
      if (testError.message.includes('column') && testError.message.includes('does not exist')) {
        console.error('❌ Columns still missing. Manual SQL execution required.');
        console.log('\n📋 MANUAL INSTRUCTIONS:');
        console.log('   1. Go to your Supabase Dashboard');
        console.log('   2. Navigate to the SQL Editor');
        console.log('   3. Execute the following SQL:');
        console.log('');
        console.log('   ALTER TABLE districts ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);');
        console.log('   ALTER TABLE districts ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);');
        console.log('   ALTER TABLE districts ADD COLUMN IF NOT EXISTS logo_url TEXT;');
        console.log('');
        console.log('   4. Add constraints (optional):');
        console.log('   ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_primary_color_format CHECK (primary_color IS NULL OR primary_color ~ \'^#[0-9A-Fa-f]{6}$\');');
        console.log('   ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_secondary_color_format CHECK (secondary_color IS NULL OR secondary_color ~ \'^#[0-9A-Fa-f]{6}$\');');
        console.log('');
        return false;
      } else {
        console.log('⚠️  Query error (might be authentication related):', testError.message);
      }
    } else {
      console.log('✅ SUCCESS! Columns are accessible');
      console.log(`   Found ${data?.length || 0} district records`);
      
      if (data && data.length > 0) {
        console.log('\n📊 Sample data:');
        data.forEach(district => {
          console.log(`   - ${district.name}: primary_color=${district.primary_color || 'NULL'}, secondary_color=${district.secondary_color || 'NULL'}`);
        });
      }
      
      console.log('\n🎉 MIGRATION COMPLETE!');
      console.log('   The Create New District form should now work properly.');
      return true;
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

// Execute the migration
addBrandingColumns()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch(console.error);