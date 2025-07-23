-- Fix RLS policies for analytics tables to allow server-side session tracking
-- The application automatically tracks user sessions, not users manually creating them

-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "System can track user sessions" ON user_sessions;
DROP POLICY IF EXISTS "System can track page views" ON user_page_views;
DROP POLICY IF EXISTS "System can track user actions" ON user_actions;
DROP POLICY IF EXISTS "System can update user sessions" ON user_sessions;
DROP POLICY IF EXISTS "System can update page views" ON user_page_views;
DROP POLICY IF EXISTS "System can update user actions" ON user_actions;

-- Create INSERT policies
CREATE POLICY "System can track user sessions" ON user_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "System can track page views" ON user_page_views
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "System can track user actions" ON user_actions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Create UPDATE policies (these are the critical missing ones)
CREATE POLICY "System can update user sessions" ON user_sessions
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "System can update page views" ON user_page_views
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "System can update user actions" ON user_actions
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );