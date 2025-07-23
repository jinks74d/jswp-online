-- Safely add missing fields to assignments table
-- Execute this SQL in your Supabase SQL editor

-- Add class_period_id field if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='assignments' AND column_name='class_period_id') THEN
        ALTER TABLE assignments ADD COLUMN class_period_id UUID REFERENCES class_periods(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add prompt field if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='assignments' AND column_name='prompt') THEN
        ALTER TABLE assignments ADD COLUMN prompt TEXT;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_period_id ON assignments(class_period_id);

-- Update RLS policies to include student access
DROP POLICY IF EXISTS "Students can view assignments from their school" ON assignments;
CREATE POLICY "Students can view assignments from their school" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = assignments.school_id 
      AND user_profiles.role = 'student'
    )
  );

-- Update existing teacher policy to include school access
DROP POLICY IF EXISTS "Teachers can manage their own assignments" ON assignments;
CREATE POLICY "Teachers can manage their own assignments" ON assignments
  FOR ALL USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = assignments.school_id 
      AND user_profiles.role IN ('teacher', 'school_admin', 'district_admin')
    )
  );
