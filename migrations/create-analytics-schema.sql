-- Analytics Database Schema for JSWP Online
-- This schema tracks user sessions and provides analytics at school/district levels

-- Create user_sessions table for tracking login sessions
CREATE TABLE user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER,
  pages_visited INTEGER DEFAULT 1,
  actions_count INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  browser_info JSONB DEFAULT '{}',
  device_type VARCHAR(50), -- 'desktop', 'tablet', 'mobile'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_page_views table for detailed page tracking
CREATE TABLE user_page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(500),
  time_on_page INTEGER, -- seconds spent on page
  referrer_path VARCHAR(500),
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_actions table for tracking specific user interactions
CREATE TABLE user_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL, -- 'assignment_save', 'form_submit', 'file_upload', etc.
  action_details JSONB DEFAULT '{}',
  page_path VARCHAR(500),
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage all sessions" ON user_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "District admins can view district sessions" ON user_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.district_id = user_sessions.district_id
      AND user_profiles.role IN ('district_admin', 'school_admin')
    )
  );

CREATE POLICY "School admins can view school sessions" ON user_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = user_sessions.school_id
      AND user_profiles.role = 'school_admin'
    )
  );

-- RLS Policies for user_page_views
CREATE POLICY "Users can view their own page views" ON user_page_views
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "District admins can view district page views" ON user_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.district_id = user_page_views.district_id
      AND user_profiles.role IN ('district_admin', 'school_admin')
    )
  );

CREATE POLICY "School admins can view school page views" ON user_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = user_page_views.school_id
      AND user_profiles.role = 'school_admin'
    )
  );

-- RLS Policies for user_actions
CREATE POLICY "Users can view their own actions" ON user_actions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "District admins can view district actions" ON user_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.district_id = user_actions.district_id
      AND user_profiles.role IN ('district_admin', 'school_admin')
    )
  );

CREATE POLICY "School admins can view school actions" ON user_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = user_actions.school_id
      AND user_profiles.role = 'school_admin'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_district_id ON user_sessions(district_id);
CREATE INDEX idx_user_sessions_school_id ON user_sessions(school_id);
CREATE INDEX idx_user_sessions_date ON user_sessions(session_start);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_duration ON user_sessions(duration_minutes) WHERE duration_minutes IS NOT NULL;

CREATE INDEX idx_user_page_views_session_id ON user_page_views(session_id);
CREATE INDEX idx_user_page_views_user_id ON user_page_views(user_id);
CREATE INDEX idx_user_page_views_district_id ON user_page_views(district_id);
CREATE INDEX idx_user_page_views_school_id ON user_page_views(school_id);
CREATE INDEX idx_user_page_views_date ON user_page_views(viewed_at);
CREATE INDEX idx_user_page_views_path ON user_page_views(page_path);

CREATE INDEX idx_user_actions_session_id ON user_actions(session_id);
CREATE INDEX idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX idx_user_actions_district_id ON user_actions(district_id);
CREATE INDEX idx_user_actions_school_id ON user_actions(school_id);
CREATE INDEX idx_user_actions_type ON user_actions(action_type);
CREATE INDEX idx_user_actions_date ON user_actions(performed_at);
CREATE INDEX idx_user_actions_assignment ON user_actions(assignment_id) WHERE assignment_id IS NOT NULL;

-- Create functions for analytics calculations
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate duration when session ends
  IF NEW.session_end IS NOT NULL AND OLD.session_end IS NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) / 60;
  END IF;
  
  -- Update last_activity timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session duration calculation
CREATE TRIGGER trigger_calculate_session_duration
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();

-- Create function to get active users count
CREATE OR REPLACE FUNCTION get_active_users_count(
  p_district_id UUID DEFAULT NULL,
  p_school_id UUID DEFAULT NULL,
  p_time_window INTERVAL DEFAULT INTERVAL '15 minutes'
)
RETURNS INTEGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO user_count
  FROM user_sessions
  WHERE is_active = true
    AND last_activity > NOW() - p_time_window
    AND (p_district_id IS NULL OR district_id = p_district_id)
    AND (p_school_id IS NULL OR school_id = p_school_id);
    
  RETURN COALESCE(user_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for daily analytics (refresh periodically)
CREATE MATERIALIZED VIEW daily_usage_analytics AS
SELECT
  DATE(session_start) as usage_date,
  district_id,
  school_id,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_sessions,
  AVG(duration_minutes) as avg_session_minutes,
  SUM(duration_minutes) as total_minutes,
  SUM(pages_visited) as total_page_views,
  SUM(actions_count) as total_actions
FROM user_sessions
WHERE session_start >= CURRENT_DATE - INTERVAL '90 days'
  AND duration_minutes IS NOT NULL
GROUP BY DATE(session_start), district_id, school_id;

-- Create index on materialized view
CREATE INDEX idx_daily_usage_analytics_date ON daily_usage_analytics(usage_date);
CREATE INDEX idx_daily_usage_analytics_district ON daily_usage_analytics(district_id);
CREATE INDEX idx_daily_usage_analytics_school ON daily_usage_analytics(school_id);

-- Create function to refresh daily analytics (call this via cron or periodically)
CREATE OR REPLACE FUNCTION refresh_daily_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW daily_usage_analytics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the analytics functions
GRANT EXECUTE ON FUNCTION get_active_users_count TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_daily_analytics TO authenticated;
GRANT SELECT ON daily_usage_analytics TO authenticated;