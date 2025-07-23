-- Add concrete_details field to student_assignment_progress table
-- Execute this SQL in your Supabase SQL editor

ALTER TABLE student_assignment_progress 
ADD COLUMN concrete_details TEXT;

-- Create index for performance
CREATE INDEX idx_student_assignment_progress_concrete_details ON student_assignment_progress(concrete_details);
