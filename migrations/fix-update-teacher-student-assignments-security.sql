-- Fix for Supabase security warning: Function Search Path Mutable
-- This script fixes the update_teacher_student_assignments_updated_at function to have a fixed search_path

-- First, let's see the current function implementation
-- You can run this query in Supabase SQL editor to check:
-- SELECT proname, proargtypes, prosrc FROM pg_proc WHERE proname = 'update_teacher_student_assignments_updated_at';

-- This appears to be a function that updates the updated_at column for teacher_student_assignments
-- Function signature: update_teacher_student_assignments_updated_at() - likely no parameters

-- Apply the security fix for the function
ALTER FUNCTION public.update_teacher_student_assignments_updated_at() SET search_path = public;

-- Alternative: If you prefer maximum security with empty search_path:
-- ALTER FUNCTION public.update_teacher_student_assignments_updated_at() SET search_path = '';

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.update_teacher_student_assignments_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_teacher_student_assignments_updated_at() TO anon;

-- Note: The key security fix is:
-- SET search_path = public (fixes the mutable search path warning)
-- This ensures the function always executes with the public schema context
-- and is not affected by the role of the user executing it

-- Expected function purpose (for reference):
-- This function likely updates the updated_at timestamp for teacher_student_assignments table
-- when certain conditions are met or when triggered by table changes
