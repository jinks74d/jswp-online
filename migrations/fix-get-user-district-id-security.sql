-- Fix for Supabase security warning: Function Search Path Mutable
-- This script fixes the get_user_district_id function to have a fixed search_path

-- First, let's see the current function implementation
-- You can run this query in Supabase SQL editor to check:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_user_district_id';

-- Fix the existing get_user_district_id function with proper search_path
-- This function likely has a user_id parameter and returns the district_id

-- Function signature discovered: get_user_district_id() - no parameters
-- Current function: SELECT district_id FROM user_profiles WHERE id = auth.uid();

-- Apply the security fix for function with no parameters
ALTER FUNCTION public.get_user_district_id() SET search_path = public;

-- Method 2: If ALTER doesn't work or you need to see the current implementation first,
-- uncomment the lines below and replace with the actual function logic:

-- CREATE OR REPLACE FUNCTION public.get_user_district_id(user_id bigint)
-- RETURNS bigint
-- LANGUAGE plpgsql
-- SECURITY INVOKER
-- SET search_path = public
-- AS $$
-- BEGIN
--     -- Replace this with the actual function logic
--     -- Example implementation:
--     RETURN (
--         SELECT district_id 
--         FROM public.user_profiles 
--         WHERE id = user_id
--         LIMIT 1
--     );
-- END;
-- $$;

-- Grant appropriate permissions (adjust as needed)
GRANT EXECUTE ON FUNCTION public.get_user_district_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_district_id() TO anon;

-- Note: The key security fix is:
-- SET search_path = public (fixes the mutable search path warning)
-- This ensures the function always executes with the public schema context
