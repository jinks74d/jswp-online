-- Create table for student assignment progress
-- This table will store each student's individual progress on assignments
-- Execute this SQL in your Supabase SQL editor

CREATE TABLE student_assignment_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign keys for data isolation
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Student's form data (the new fields we added)
  working_on TEXT, -- What are you working on today (New Body Paragraph, Introduction, Conclusion)
  paragraph_name TEXT, -- Name Your Body Paragraph, Introduction, or Conclusion
  selected_chunks INTEGER DEFAULT 1, -- Select one or two chunks (1 or 2)
  notes TEXT, -- Any additional notes
  
  -- Progress tracking
  status TEXT DEFAULT 'in_progress', -- in_progress, submitted, graded
  progress_percentage INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_saved TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure each student has only one progress record per assignment
  UNIQUE(assignment_id, student_id)
);

-- Enable Row Level Security
ALTER TABLE student_assignment_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students can only access their own progress
CREATE POLICY "Students can manage their own assignment progress" ON student_assignment_progress
  FOR ALL USING (student_id = auth.uid());

-- RLS Policy: Teachers can view progress for their assignments
CREATE POLICY "Teachers can view progress for their assignments" ON student_assignment_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignments.id = student_assignment_progress.assignment_id 
      AND assignments.teacher_id = auth.uid()
    )
  );

-- RLS Policy: School/District admins can view progress in their scope
CREATE POLICY "Admins can view assignment progress in their scope" ON student_assignment_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      JOIN assignments ON assignments.id = student_assignment_progress.assignment_id
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.district_id = assignments.district_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

-- Create indexes for performance
CREATE INDEX idx_student_assignment_progress_assignment_id ON student_assignment_progress(assignment_id);
CREATE INDEX idx_student_assignment_progress_student_id ON student_assignment_progress(student_id);
CREATE INDEX idx_student_assignment_progress_status ON student_assignment_progress(status);
CREATE INDEX idx_student_assignment_progress_updated_at ON student_assignment_progress(updated_at);

-- Create composite index for the unique constraint
CREATE INDEX idx_student_assignment_progress_composite ON student_assignment_progress(assignment_id, student_id);
