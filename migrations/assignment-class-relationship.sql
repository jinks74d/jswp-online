-- Add class_period_id to assignments table to connect assignments to specific class periods
-- This allows students to see assignments from classes they're enrolled in

-- Add class_period_id column to assignments table
ALTER TABLE assignments 
ADD COLUMN class_period_id UUID REFERENCES class_periods(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_class_period_id ON assignments(class_period_id);

-- Update RLS policies for assignments to include student access
-- Students can view assignments from classes they're enrolled in
CREATE POLICY "Students can view assignments from their enrolled classes" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_student_enrollments 
      WHERE class_student_enrollments.student_id = auth.uid() 
      AND class_student_enrollments.class_period_id = assignments.class_period_id
    )
  );

-- Teachers can view assignments from classes they're assigned to teach
CREATE POLICY "Teachers can view assignments from their assigned classes" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_teacher_assignments 
      WHERE class_teacher_assignments.teacher_id = auth.uid() 
      AND class_teacher_assignments.class_period_id = assignments.class_period_id
    )
  );

-- Update the existing teacher policy to be more specific
DROP POLICY IF EXISTS "Teachers can manage their own assignments" ON assignments;
CREATE POLICY "Teachers can manage their own assignments" ON assignments
  FOR ALL USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM class_teacher_assignments 
      WHERE class_teacher_assignments.teacher_id = auth.uid() 
      AND class_teacher_assignments.class_period_id = assignments.class_period_id
    )
  );
