-- Fix for Supabase security warning: Function Search Path Mutable
-- This script fixes the get_user_school_id function to have a fixed search_path

-- First, let's see the current function implementation
-- You can run this query in Supabase SQL editor to check:
-- SELECT proname, proargtypes, prosrc FROM pg_proc WHERE proname = 'get_user_school_id';

-- Function signature confirmed: get_user_school_id() - no parameters
-- Current function: SELECT school_id FROM user_profiles WHERE id = auth.uid();

-- Apply the security fix for function with no parameters
ALTER FUNCTION public.get_user_school_id() SET search_path = public;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_school_id() TO anon;

-- Note: The key security fix is:
-- SET search_path = public (fixes the mutable search path warning)
-- This ensures the function always executes with the public schema context

-- Expected function implementation (for reference):
-- SELECT school_id FROM user_profiles WHERE id = auth.uid();
