// Script to check and fix analytics setup
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
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAnalyticsTables() {
  console.log('Checking if analytics tables exist...');
  
  // Check if user_sessions table exists
  const { data: tables, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_sessions', 'user_page_views', 'user_actions');
    `
  });
  
  if (error) {
    console.error('Error checking tables:', error);
    return false;
  }
  
  const tableNames = tables?.map(t => t.table_name) || [];
  console.log('Existing analytics tables:', tableNames);
  
  return tableNames.includes('user_sessions') && 
         tableNames.includes('user_page_views') && 
         tableNames.includes('user_actions');
}

async function createAnalyticsSchema() {
  console.log('Creating analytics schema...');
  
  const schemaPath = path.join(__dirname, '../migrations/create-analytics-schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('Analytics schema file not found');
    return false;
  }
  
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  // Split by semicolon and execute each statement
  const statements = schemaSql.split(';').filter(stmt => stmt.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error && !error.message.includes('already exists')) {
        console.error('Error executing statement:', error);
        console.log('Statement:', statement.substring(0, 100) + '...');
      }
    }
  }
  
  console.log('Analytics schema creation completed');
  return true;
}

async function fixRLSPolicies() {
  console.log('Fixing RLS policies...');
  
  const fixPath = path.join(__dirname, '../migrations/fix-analytics-rls-policies.sql');
  if (!fs.existsSync(fixPath)) {
    console.error('RLS fix file not found');
    return false;
  }
  
  const fixSql = fs.readFileSync(fixPath, 'utf8');
  
  // Split by semicolon and execute each statement
  const statements = fixSql.split(';').filter(stmt => stmt.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error && !error.message.includes('already exists')) {
        console.error('Error executing RLS fix:', error);
        console.log('Statement:', statement.substring(0, 100) + '...');
      }
    }
  }
  
  console.log('RLS policies fix completed');
  return true;
}

async function checkStudentUser() {
  console.log('Checking student1@cisd.edu user...');
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'student1@cisd.edu')
    .single();
  
  if (error) {
    console.error('Error checking student user:', error);
    return null;
  }
  
  console.log('Student profile:', profile);
  return profile;
}

async function checkExistingSessions() {
  console.log('Checking existing session data...');
  
  const { data: sessions, error } = await supabase
    .from('user_sessions')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('Error checking sessions:', error);
    return [];
  }
  
  console.log(`Found ${sessions?.length || 0} existing sessions`);
  if (sessions && sessions.length > 0) {
    console.log('Sample session:', sessions[0]);
  }
  
  return sessions || [];
}

async function main() {
  console.log('=== Analytics Setup Check ===\n');
  
  try {
    // Check if tables exist
    const tablesExist = await checkAnalyticsTables();
    
    if (!tablesExist) {
      console.log('Analytics tables missing, creating schema...');
      await createAnalyticsSchema();
    }
    
    // Fix RLS policies
    await fixRLSPolicies();
    
    // Check student user
    const student = await checkStudentUser();
    
    // Check existing sessions
    await checkExistingSessions();
    
    console.log('\n=== Setup Complete ===');
    console.log('Next steps:');
    console.log('1. Login as student1@cisd.edu');
    console.log('2. Navigate around the dashboard');
    console.log('3. Check if sessions are being created');
    console.log('4. Login as admin to view analytics');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

main();