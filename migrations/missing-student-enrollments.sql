-- Create the missing class_student_enrollments table for student enrollment functionality
-- Execute this if you already have the other class management tables

-- Create class_student_enrollments table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS class_student_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_period_id UUID NOT NULL REFERENCES class_periods(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrolled_by UUID NOT NULL REFERENCES user_profiles(id),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_period_id, student_id)
);

-- Enable RLS on class_student_enrollments table
ALTER TABLE class_student_enrollments ENABLE ROW LEVEL SECURITY;

-- Create policies for class_student_enrollments
CREATE POLICY "School admins can manage student enrollments in their school" ON class_student_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_student_enrollments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Students can view their own enrollments" ON class_student_enrollments
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_student_enrollments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin', 'teacher')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_student_enrollments_class_period_id ON class_student_enrollments(class_period_id);
CREATE INDEX IF NOT EXISTS idx_class_student_enrollments_student_id ON class_student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_student_enrollments_school_id ON class_student_enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_class_student_enrollments_enrolled_by ON class_student_enrollments(enrolled_by);

-- Setup complete! You can now use the student enrollment functionality.
