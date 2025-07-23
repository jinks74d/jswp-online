-- Only create the missing class_teacher_assignments table and policies
-- Execute this if you already have subjects, classes, and class_periods tables

-- Create class_teacher_assignments table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS class_teacher_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_period_id UUID NOT NULL REFERENCES class_periods(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_period_id, teacher_id)
);

-- Enable RLS on class_teacher_assignments table
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for class_teacher_assignments
CREATE POLICY "School admins can manage teacher assignments in their school" ON class_teacher_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_teacher_assignments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Teachers can view their own assignments" ON class_teacher_assignments
  FOR SELECT USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_teacher_assignments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin', 'teacher')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class_period_id ON class_teacher_assignments(class_period_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher_id ON class_teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_school_id ON class_teacher_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_assigned_by ON class_teacher_assignments(assigned_by);

-- Setup complete! You can now use the teacher assignment functionality.
