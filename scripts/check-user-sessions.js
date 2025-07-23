// Script to check user_sessions table in Supabase database
// Run with: node scripts/check-user-sessions.js

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
  console.error('Missing Supabase configuration. Please check your .env.local file.');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserSessions() {
  console.log('🔍 Checking user_sessions table...\n');

  try {
    // 1. Total sessions count
    const { data: allSessions, error: countError } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting sessions:', countError);
      return;
    }

    console.log(`📊 Total sessions in database: ${allSessions?.length || 0}`);

    // 2. Sessions with session_end = NULL (still active)
    const { data: activeSessions, error: activeError } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact' })
      .is('session_end', null);

    if (activeError) {
      console.error('Error counting active sessions:', activeError);
    } else {
      console.log(`🟢 Sessions with session_end = NULL: ${activeSessions?.length || 0}`);
    }

    // 3. Sessions with duration_minutes = NULL
    const { data: noDurationSessions, error: durationError } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact' })
      .is('duration_minutes', null);

    if (durationError) {
      console.error('Error counting sessions without duration:', durationError);
    } else {
      console.log(`⏰ Sessions with duration_minutes = NULL: ${noDurationSessions?.length || 0}`);
    }

    // 4. Get sample records with details
    console.log('\n📋 Sample session records:');
    const { data: sampleSessions, error: sampleError } = await supabase
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
      .order('session_start', { ascending: false })
      .limit(10);

    if (sampleError) {
      console.error('Error fetching sample sessions:', sampleError);
    } else {
      sampleSessions?.forEach((session, index) => {
        const user = session.user_profiles;
        console.log(`\n${index + 1}. Session ID: ${session.id.substring(0, 8)}...`);
        console.log(`   User: ${user.first_name} ${user.last_name} (${user.role})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Start: ${new Date(session.session_start).toLocaleString()}`);
        console.log(`   End: ${session.session_end ? new Date(session.session_end).toLocaleString() : 'NULL (still active)'}`);
        console.log(`   Duration: ${session.duration_minutes || 'NULL'} minutes`);
        console.log(`   Is Active: ${session.is_active}`);
      });
    }

    // 5. Check for student user sessions specifically
    console.log('\n👨‍🎓 Student user sessions:');
    const { data: studentSessions, error: studentError } = await supabase
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
      .eq('user_profiles.role', 'student')
      .order('session_start', { ascending: false })
      .limit(5);

    if (studentError) {
      console.error('Error fetching student sessions:', studentError);
    } else {
      console.log(`Found ${studentSessions?.length || 0} student sessions (showing up to 5):`);
      studentSessions?.forEach((session, index) => {
        const user = session.user_profiles;
        console.log(`\n${index + 1}. Student: ${user.first_name} ${user.last_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Start: ${new Date(session.session_start).toLocaleString()}`);
        console.log(`   End: ${session.session_end ? new Date(session.session_end).toLocaleString() : 'NULL'}`);
        console.log(`   Duration: ${session.duration_minutes || 'NULL'} minutes`);
        console.log(`   Active: ${session.is_active}`);
      });
    }

    // 6. Check sessions by role breakdown
    console.log('\n📈 Sessions by user role:');
    const { data: roleStats, error: roleError } = await supabase
      .from('user_sessions')
      .select(`
        user_profiles!inner(role),
        duration_minutes
      `);

    if (roleError) {
      console.error('Error fetching role stats:', roleError);
    } else {
      const roleBreakdown = {};
      roleStats?.forEach(session => {
        const role = session.user_profiles.role;
        if (!roleBreakdown[role]) {
          roleBreakdown[role] = {
            total: 0,
            withDuration: 0,
            withoutDuration: 0
          };
        }
        roleBreakdown[role].total++;
        if (session.duration_minutes !== null) {
          roleBreakdown[role].withDuration++;
        } else {
          roleBreakdown[role].withoutDuration++;
        }
      });

      Object.entries(roleBreakdown).forEach(([role, stats]) => {
        console.log(`   ${role}: ${stats.total} sessions (${stats.withDuration} with duration, ${stats.withoutDuration} without)`);
      });
    }

    // 7. Recent activity check
    console.log('\n⏱️  Recent session activity (last 24 hours):');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSessions, error: recentError } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact' })
      .gte('session_start', twentyFourHoursAgo);

    if (recentError) {
      console.error('Error fetching recent sessions:', recentError);
    } else {
      console.log(`Sessions started in last 24 hours: ${recentSessions?.length || 0}`);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkUserSessions().then(() => {
  console.log('\n✅ Session check completed!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});