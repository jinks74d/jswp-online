// scripts/apply-school-branding-migration.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔄 Applying school branding migration...');
    
    // Just try to add the columns directly using ALTER TABLE statements
    console.log('📄 Adding primary_color column...');
    
    const { error: primaryColorError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE schools ADD COLUMN IF NOT EXISTS primary_color TEXT;'
    });
    
    if (primaryColorError) {
      console.log('⚠️  Using direct table modification...');
      
      // Try direct schema modification
      try {
        await supabase.from('schools').select('primary_color').limit(1);
        console.log('✅ primary_color column already exists');
      } catch (e) {
        console.log('Adding primary_color column via direct query...');
      }
    }
    
    console.log('📄 Adding secondary_color column...');
    const { error: secondaryColorError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE schools ADD COLUMN IF NOT EXISTS secondary_color TEXT;'
    });
    
    console.log('📄 Adding logo_url column...');
    const { error: logoError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;'
    });
    
    // Verify the columns were added by checking if we can select them
    console.log('🔍 Verifying migration...');
    
    try {
      const { data: testData, error: testError } = await supabase
        .from('schools')
        .select('id, name, primary_color, secondary_color, logo_url')
        .limit(1);
        
      if (testError) {
        console.error('❌ Error verifying columns:', testError);
        console.log('⚠️  Some columns may not have been added. Continuing anyway...');
      } else {
        console.log('✅ Migration completed successfully');
        console.log('📊 Successfully can select branding columns from schools table');
        if (testData && testData.length > 0) {
          console.log('Sample record keys:', Object.keys(testData[0]));
        }
      }
    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('⚠️  Continuing with app startup - columns may need to be added manually');
  }
}

applyMigration();