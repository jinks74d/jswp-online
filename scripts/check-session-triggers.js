// Script to check session triggers and duration calculation
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTriggers() {
  console.log('🔧 Checking database triggers and functions...\n');

  try {
    // Check if the trigger function exists
    const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          proname as function_name,
          prokind as function_type,
          pg_get_functiondef(oid) as function_definition
        FROM pg_proc 
        WHERE proname = 'calculate_session_duration';
      `
    });

    if (funcError) {
      console.error('Error checking functions:', funcError);
    } else {
      console.log(`📋 Function 'calculate_session_duration': ${functions?.length > 0 ? 'EXISTS' : 'MISSING'}`);
      if (functions?.length > 0) {
        console.log('Function definition preview:', functions[0].function_definition.substring(0, 200) + '...');
      }
    }

    // Check if the trigger exists
    const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          tgname as trigger_name,
          tgrelid::regclass as table_name,
          tgtype,
          tgenabled
        FROM pg_trigger 
        WHERE tgname = 'trigger_calculate_session_duration';
      `
    });

    if (trigError) {
      console.error('Error checking triggers:', trigError);
    } else {
      console.log(`🔄 Trigger 'trigger_calculate_session_duration': ${triggers?.length > 0 ? 'EXISTS' : 'MISSING'}`);
      if (triggers?.length > 0) {
        console.log('Trigger details:', triggers[0]);
      }
    }

    // Get detailed session information with calculated durations
    console.log('\n📊 Detailed session analysis:');
    const { data: sessions, error: sessError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          id,
          user_id,
          session_start,
          session_end,
          duration_minutes,
          is_active,
          CASE 
            WHEN session_end IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (session_end - session_start)) / 60
            ELSE 
              EXTRACT(EPOCH FROM (NOW() - session_start)) / 60
          END as calculated_duration_minutes
        FROM user_sessions
        ORDER BY session_start DESC
        LIMIT 10;
      `
    });

    if (sessError) {
      console.error('Error getting session details:', sessError);
    } else {
      console.log('Recent sessions with calculated durations:');
      sessions?.forEach((session, index) => {
        console.log(`${index + 1}. Session ${session.id.substring(0, 8)}...`);
        console.log(`   Start: ${new Date(session.session_start).toLocaleString()}`);
        console.log(`   End: ${session.session_end ? new Date(session.session_end).toLocaleString() : 'NULL'}`);
        console.log(`   Stored Duration: ${session.duration_minutes || 'NULL'} minutes`);
        console.log(`   Calculated Duration: ${Math.round(session.calculated_duration_minutes || 0)} minutes`);
        console.log(`   Active: ${session.is_active}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkTriggers().then(() => {
  console.log('✅ Trigger check completed!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});