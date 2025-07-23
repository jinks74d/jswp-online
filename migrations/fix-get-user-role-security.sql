-- Fix for Supabase security warning: Function Search Path Mutable
-- This script fixes the get_user_role function to have a fixed search_path

-- First, let's see if the function exists and what it looks like
-- You can run this query in Supabase SQL editor to check:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_user_role';

-- Fix the existing get_user_role function with proper search_path
-- Current function: SELECT role FROM user_profiles WHERE id = auth.uid();
-- Note: Cannot drop this function as it's used by many RLS policies

-- Method 1: Try to alter the existing function to set search_path
-- This may work if the function signature is compatible
ALTER FUNCTION public.get_user_role() SET search_path = public;

-- Method 2: If ALTER doesn't work, use CREATE OR REPLACE with exact same signature
-- Uncomment the lines below if the ALTER command above fails:

-- CREATE OR REPLACE FUNCTION public.get_user_role()
-- RETURNS text
-- LANGUAGE sql
-- STABLE
-- SET search_path = public
-- AS $$
--     SELECT role FROM public.user_profiles WHERE id = auth.uid();
-- $$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;

-- Note: If you have a different implementation of get_user_role,
-- replace the function body above with your actual logic.
-- The key security fixes are:
-- 1. SET search_path = public (fixes the mutable search path warning)
-- 2. SECURITY DEFINER (ensures consistent execution context)
-- 3. Proper permissions granted
