// Script to diagnose the duration calculation issue
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

async function diagnoseDurationIssue() {
  console.log('🔍 Diagnosing session duration calculation issue...\n');

  try {
    // Get all sessions with calculated durations
    const { data: allSessions, error: allError } = await supabase
      .from('user_sessions')
      .select(`
        id,
        user_id,
        session_start,
        session_end,
        duration_minutes,
        is_active,
        user_profiles!inner(
          first_name,
          last_name,
          role,
          email
        )
      `)
      .order('session_start', { ascending: false });

    if (allError) {
      console.error('Error fetching sessions:', allError);
      return;
    }

    console.log(`📊 Total sessions found: ${allSessions?.length || 0}\n`);

    // Analyze each session
    const analysis = {
      total: allSessions?.length || 0,
      withEnd: 0,
      withoutEnd: 0,
      withDuration: 0,
      withoutDuration: 0,
      active: 0,
      inactive: 0
    };

    console.log('📋 Session-by-session analysis:\n');

    allSessions?.forEach((session, index) => {
      const user = session.user_profiles;
      const hasEnd = session.session_end !== null;
      const hasDuration = session.duration_minutes !== null;
      
      // Calculate what duration should be
      let calculatedDuration = 0;
      if (hasEnd) {
        const start = new Date(session.session_start);
        const end = new Date(session.session_end);
        calculatedDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }

      console.log(`${index + 1}. ${user.first_name} ${user.last_name} (${user.role})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Session ID: ${session.id.substring(0, 8)}...`);
      console.log(`   Start: ${new Date(session.session_start).toLocaleString()}`);
      console.log(`   End: ${hasEnd ? new Date(session.session_end).toLocaleString() : '❌ NULL'}`);
      console.log(`   Stored Duration: ${session.duration_minutes || '❌ NULL'} minutes`);
      if (hasEnd) {
        console.log(`   Calculated Duration: ${calculatedDuration} minutes`);
        if (hasDuration && session.duration_minutes !== calculatedDuration) {
          console.log(`   ⚠️  MISMATCH: Stored (${session.duration_minutes}) vs Calculated (${calculatedDuration})`);
        }
      }
      console.log(`   Active: ${session.is_active ? '🟢 Yes' : '🔴 No'}`);
      console.log('');

      // Update analysis
      if (hasEnd) analysis.withEnd++;
      else analysis.withoutEnd++;
      
      if (hasDuration) analysis.withDuration++;
      else analysis.withoutDuration++;
      
      if (session.is_active) analysis.active++;
      else analysis.inactive++;
    });

    console.log('📈 Summary Analysis:');
    console.log(`   Total Sessions: ${analysis.total}`);
    console.log(`   With End Time: ${analysis.withEnd}`);
    console.log(`   Without End Time: ${analysis.withoutEnd}`);
    console.log(`   With Duration: ${analysis.withDuration}`);
    console.log(`   Without Duration: ${analysis.withoutDuration}`);
    console.log(`   Active: ${analysis.active}`);
    console.log(`   Inactive: ${analysis.inactive}`);

    // Check for the main issue
    console.log('\n🚨 Issues Identified:');
    
    if (analysis.withEnd > 0 && analysis.withoutDuration > 0) {
      console.log(`❌ PROBLEM: ${analysis.withoutDuration} sessions have end times but NO duration calculated`);
      console.log('   This suggests the trigger is not working or not being fired.');
    }
    
    if (analysis.withoutEnd > 0 && analysis.active === 0) {
      console.log(`❌ PROBLEM: ${analysis.withoutEnd} sessions missing end times but marked as inactive`);
      console.log('   Sessions should be ended properly when users log out.');
    }

    if (analysis.active > 1) {
      console.log(`⚠️  WARNING: ${analysis.active} active sessions found`);
      console.log('   Users should typically have only one active session at a time.');
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('1. The trigger `calculate_session_duration()` may not be working properly');
    console.log('2. Sessions are not being ended correctly via the API');
    console.log('3. Check if the session tracking is properly integrated in the frontend');
    console.log('4. Manual fix: Update sessions with missing durations');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the diagnosis
diagnoseDurationIssue().then(() => {
  console.log('\n✅ Diagnosis completed!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});