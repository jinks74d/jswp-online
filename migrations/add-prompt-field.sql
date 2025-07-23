-- Add the missing prompt field to assignments table
-- Execute this in your Supabase SQL editor

-- Add prompt field for writing prompts
ALTER TABLE assignments ADD COLUMN prompt TEXT;

-- Create index for performance
CREATE INDEX idx_assignments_prompt ON assignments(prompt);
