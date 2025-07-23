-- Add missing fields to assignments table
-- This will allow the teacher form to save properly and the student form to display the prompt
-- Execute this SQL in your Supabase SQL editor

-- Add school_id field
ALTER TABLE assignments 
ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Add class_period_id field (if not already added from assignment-class-relationship.sql)
ALTER TABLE assignments 
ADD COLUMN class_period_id UUID REFERENCES class_periods(id) ON DELETE CASCADE;

-- Add prompt field for writing prompts
ALTER TABLE assignments 
ADD COLUMN prompt TEXT;

-- Create indexes for performance
CREATE INDEX idx_assignments_school_id ON assignments(school_id);
CREATE INDEX idx_assignments_class_period_id ON assignments(class_period_id);

-- Update RLS policies to include school_id access
-- Students can view assignments from their school
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
