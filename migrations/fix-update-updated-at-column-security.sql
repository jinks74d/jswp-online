-- Fix for Supabase security warning: Function Search Path Mutable
-- This script fixes the update_updated_at_column function to have a fixed search_path

-- First, let's see the current function implementation
-- You can run this query in Supabase SQL editor to check:
-- SELECT proname, proargtypes, prosrc FROM pg_proc WHERE proname = 'update_updated_at_column';

-- This is a trigger function that updates the updated_at column
-- Function signature confirmed: update_updated_at_column() - no parameters, returns TRIGGER

-- Apply the security fix for trigger function
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Alternative: If you prefer to use public schema instead of empty search_path:
-- ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Grant appropriate permissions for trigger function
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon;

-- Note: The key security fixes are:
-- SET search_path = '' (empty string for maximum security)
-- This ensures the function only accesses fully qualified object names
-- and is not affected by any changes to the search path during execution

-- Expected function implementation (for reference):
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     NEW.updated_at := NOW();
--     RETURN NEW;
-- END;
-- $$;
