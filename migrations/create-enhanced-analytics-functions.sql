-- Enhanced Analytics Database Functions
-- Execute this SQL in your Supabase SQL editor

-- Function to get session analytics data
CREATE OR REPLACE FUNCTION get_analytics_sessions(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    district_id UUID,
    school_id UUID,
    session_start TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    pages_visited INTEGER,
    actions_count INTEGER,
    device_type TEXT,
    role TEXT,
    first_name TEXT,
    last_name TEXT,
    last_activity TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user_sessions table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        -- Return empty result set if table doesn't exist
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        s.user_id,
        s.district_id,
        s.school_id,
        s.session_start,
        s.duration_minutes,
        s.pages_visited,
        s.actions_count,
        s.device_type,
        up.role,
        up.first_name,
        up.last_name,
        s.last_activity
    FROM user_sessions s
    LEFT JOIN user_profiles up ON up.id = s.user_id
    WHERE s.session_start >= p_start_date
      AND s.session_start <= p_end_date
      AND (p_district_id IS NULL OR s.district_id = p_district_id)
      AND (p_school_id IS NULL OR s.school_id = p_school_id)
    ORDER BY s.session_start DESC
    LIMIT 5000;
END;
$$;

-- Function to get assignment analytics
CREATE OR REPLACE FUNCTION get_assignment_analytics(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL
)
RETURNS TABLE (
    assignment_id UUID,
    student_id UUID,
    status TEXT,
    completed_on_time BOOLEAN,
    completion_date TIMESTAMP WITH TIME ZONE,
    assignment_title TEXT,
    due_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_assignment_progress') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments') THEN
        -- Return empty result set if tables don't exist
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        sap.assignment_id,
        sap.student_id,
        sap.status::TEXT,
        (sap.completion_date IS NOT NULL AND sap.completion_date <= a.due_date) as completed_on_time,
        sap.completion_date,
        a.title as assignment_title,
        a.due_date
    FROM student_assignment_progress sap
    LEFT JOIN assignments a ON a.id = sap.assignment_id
    WHERE a.created_at >= p_start_date
      AND a.created_at <= p_end_date
      AND (p_district_id IS NULL OR a.district_id = p_district_id)
      AND (p_school_id IS NULL OR a.school_id = p_school_id)
    ORDER BY sap.updated_at DESC
    LIMIT 5000;
END;
$$;

-- Function to get user activity analytics
CREATE OR REPLACE FUNCTION get_user_activity_analytics(
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    role TEXT,
    first_name TEXT,
    last_name TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    school_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id as user_id,
        up.role,
        up.first_name,
        up.last_name,
        up.last_login,
        s.name as school_name
    FROM user_profiles up
    LEFT JOIN schools s ON s.id = up.school_id
    WHERE (p_district_id IS NULL OR up.district_id = p_district_id)
      AND (p_school_id IS NULL OR up.school_id = p_school_id)
      AND up.role IN ('teacher', 'student', 'school_admin')
    ORDER BY up.last_login DESC NULLS LAST
    LIMIT 5000;
END;
$$;

-- Function to get school performance analytics
CREATE OR REPLACE FUNCTION get_school_performance_analytics(
    p_district_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    school_id UUID,
    school_name TEXT,
    engagement_score INTEGER,
    completion_rate INTEGER,
    avg_time_spent INTEGER,
    trend TEXT,
    teacher_count INTEGER,
    student_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as school_id,
        s.name as school_name,
        COALESCE(
            (SELECT COUNT(DISTINCT us.user_id)::INTEGER * 10 
             FROM user_sessions us 
             JOIN user_profiles up ON up.id = us.user_id
             WHERE us.school_id = s.id 
               AND us.session_start >= p_start_date
               AND us.session_start <= p_end_date
               AND up.role IN ('teacher', 'student')
            ), 0
        ) as engagement_score,
        COALESCE(
            (SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        (COUNT(CASE WHEN sap.status = 'completed' THEN 1 END) * 100 / COUNT(*))::INTEGER
                    ELSE 0 
                END
             FROM student_assignment_progress sap
             JOIN assignments a ON a.id = sap.assignment_id
             WHERE a.school_id = s.id
               AND a.created_at >= p_start_date
               AND a.created_at <= p_end_date
            ), 0
        ) as completion_rate,
        COALESCE(
            (SELECT AVG(us.duration_minutes)::INTEGER
             FROM user_sessions us 
             JOIN user_profiles up ON up.id = us.user_id
             WHERE us.school_id = s.id 
               AND us.session_start >= p_start_date
               AND us.session_start <= p_end_date
               AND up.role IN ('teacher', 'student')
               AND us.duration_minutes > 0
            ), 0
        ) as avg_time_spent,
        'stable'::TEXT as trend,
        (SELECT COUNT(*) FROM user_profiles WHERE school_id = s.id AND role = 'teacher')::INTEGER as teacher_count,
        (SELECT COUNT(*) FROM user_profiles WHERE school_id = s.id AND role = 'student')::INTEGER as student_count
    FROM schools s
    WHERE (p_district_id IS NULL OR s.district_id = p_district_id)
    ORDER BY engagement_score DESC, completion_rate DESC
    LIMIT 50;
END;
$$;

-- Function to get grade level analytics
CREATE OR REPLACE FUNCTION get_grade_analytics(
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    grade_level TEXT,
    student_count INTEGER,
    avg_engagement INTEGER,
    avg_time_spent INTEGER,
    completion_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Note: This assumes grade level is stored in user_profiles table
    -- You may need to adjust based on your actual schema
    RETURN QUERY
    SELECT 
        COALESCE(up.grade_level, 'Unknown') as grade_level,
        COUNT(DISTINCT up.id)::INTEGER as student_count,
        COALESCE(
            (SELECT COUNT(DISTINCT us.session_start::date) * 10
             FROM user_sessions us 
             WHERE us.user_id = ANY(array_agg(up.id))
               AND us.session_start >= p_start_date
               AND us.session_start <= p_end_date
            ), 0
        )::INTEGER as avg_engagement,
        COALESCE(
            (SELECT AVG(us.duration_minutes)::INTEGER
             FROM user_sessions us 
             WHERE us.user_id = ANY(array_agg(up.id))
               AND us.session_start >= p_start_date
               AND us.session_start <= p_end_date
               AND us.duration_minutes > 0
            ), 0
        ) as avg_time_spent,
        COALESCE(
            (SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        (COUNT(CASE WHEN sap.status = 'completed' THEN 1 END) * 100 / COUNT(*))::INTEGER
                    ELSE 0 
                END
             FROM student_assignment_progress sap
             WHERE sap.student_id = ANY(array_agg(up.id))
            ), 0
        ) as completion_rate
    FROM user_profiles up
    WHERE up.role = 'student'
      AND (p_district_id IS NULL OR up.district_id = p_district_id)
      AND (p_school_id IS NULL OR up.school_id = p_school_id)
    GROUP BY COALESCE(up.grade_level, 'Unknown')
    ORDER BY 
        CASE 
            WHEN grade_level SIMILAR TO '[0-9]+' THEN grade_level::INTEGER 
            ELSE 999 
        END,
        grade_level
    LIMIT 20;
END;
$$;

-- Function to get teacher effectiveness data
CREATE OR REPLACE FUNCTION get_teacher_effectiveness(
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    teacher_id UUID,
    teacher_name TEXT,
    student_count INTEGER,
    avg_student_engagement INTEGER,
    assignment_completion_rate INTEGER,
    avg_response_time NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        up.id as teacher_id,
        (up.first_name || ' ' || up.last_name) as teacher_name,
        (SELECT COUNT(DISTINCT sap.student_id)
         FROM assignments a
         JOIN student_assignment_progress sap ON sap.assignment_id = a.id
         WHERE a.teacher_id = up.id
           AND a.created_at >= p_start_date
           AND a.created_at <= p_end_date
        )::INTEGER as student_count,
        COALESCE(
            (SELECT 
                CASE 
                    WHEN COUNT(DISTINCT sap.student_id) > 0 THEN
                        (COUNT(DISTINCT us.session_start::date) * 100 / COUNT(DISTINCT sap.student_id))::INTEGER
                    ELSE 0
                END
             FROM assignments a
             JOIN student_assignment_progress sap ON sap.assignment_id = a.id
             LEFT JOIN user_sessions us ON us.user_id = sap.student_id 
               AND us.session_start >= a.created_at
               AND us.session_start <= COALESCE(a.due_date, a.created_at + INTERVAL '7 days')
             WHERE a.teacher_id = up.id
               AND a.created_at >= p_start_date
               AND a.created_at <= p_end_date
            ), 0
        ) as avg_student_engagement,
        COALESCE(
            (SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        (COUNT(CASE WHEN sap.status = 'completed' THEN 1 END) * 100 / COUNT(*))::INTEGER
                    ELSE 0 
                END
             FROM assignments a
             JOIN student_assignment_progress sap ON sap.assignment_id = a.id
             WHERE a.teacher_id = up.id
               AND a.created_at >= p_start_date
               AND a.created_at <= p_end_date
            ), 0
        ) as assignment_completion_rate,
        COALESCE(
            (SELECT AVG(EXTRACT(epoch FROM (sap.updated_at - a.created_at)) / 3600)::NUMERIC(4,1)
             FROM assignments a
             JOIN student_assignment_progress sap ON sap.assignment_id = a.id
             WHERE a.teacher_id = up.id
               AND sap.status = 'completed'
               AND a.created_at >= p_start_date
               AND a.created_at <= p_end_date
            ), 0.0
        ) as avg_response_time
    FROM user_profiles up
    WHERE up.role = 'teacher'
      AND (p_district_id IS NULL OR up.district_id = p_district_id)
      AND (p_school_id IS NULL OR up.school_id = p_school_id)
    ORDER BY assignment_completion_rate DESC, avg_student_engagement DESC
    LIMIT 50;
END;
$$;

-- Function to get assignment popularity analytics
CREATE OR REPLACE FUNCTION get_assignment_popularity(
    p_district_id UUID DEFAULT NULL,
    p_school_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    assignment_id UUID,
    title TEXT,
    completions INTEGER,
    avg_completion_time INTEGER,
    popularity_rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_assignment_progress') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        a.id as assignment_id,
        a.title,
        COUNT(sap.id)::INTEGER as completions,
        COALESCE(
            AVG(
                CASE 
                    WHEN sap.completion_date IS NOT NULL THEN 
                        EXTRACT(epoch FROM (sap.completion_date - a.created_at)) / 60
                    ELSE NULL
                END
            )::INTEGER, 0
        ) as avg_completion_time,
        ROW_NUMBER() OVER (ORDER BY COUNT(sap.id) DESC)::INTEGER as popularity_rank
    FROM assignments a
    LEFT JOIN student_assignment_progress sap ON sap.assignment_id = a.id AND sap.status = 'completed'
    WHERE a.created_at >= p_start_date
      AND a.created_at <= p_end_date
      AND (p_district_id IS NULL OR a.district_id = p_district_id)
      AND (p_school_id IS NULL OR a.school_id = p_school_id)
    GROUP BY a.id, a.title
    HAVING COUNT(sap.id) > 0
    ORDER BY completions DESC
    LIMIT 20;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_analytics_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION get_assignment_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_performance_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION get_assignment_popularity TO authenticated;