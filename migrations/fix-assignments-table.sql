-- Run this SQL in your Supabase SQL editor to fix the assignments table

-- Add class_period_id column if it doesn't exist
ALTER TABLE assignments ADD COLUMN class_period_id UUID REFERENCES class_periods(id) ON DELETE CASCADE;

-- Add prompt column if it doesn't exist  
ALTER TABLE assignments ADD COLUMN prompt TEXT;

-- Create indexes for performance
CREATE INDEX idx_assignments_class_period_id ON assignments(class_period_id);
CREATE INDEX idx_assignments_prompt ON assignments(prompt);
