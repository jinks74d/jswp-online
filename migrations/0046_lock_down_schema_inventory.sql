-- ---------------------------------------------------------------------------
-- 0046_lock_down_schema_inventory.sql
--
-- Finish what 0028 intended: make public.__schema_inventory() unreachable by
-- API clients.
--
-- 0028 created the function and ran
--
--     REVOKE ALL ON FUNCTION public.__schema_inventory() FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.__schema_inventory() TO service_role;
--
-- and its header claims the function "is NOT callable by anon/authenticated
-- clients." That was wrong, and Supabase's database linter flags it: both
-- `anon` and `authenticated` can still call it via
-- /rest/v1/rpc/__schema_inventory.
--
-- The reason is that REVOKE ... FROM PUBLIC only removes the implicit grant to
-- the PUBLIC pseudo-role. Supabase ships ALTER DEFAULT PRIVILEGES for the
-- public schema that GRANT EXECUTE ON FUNCTIONS TO anon, authenticated,
-- service_role -- so at CREATE time those three roles each received their own
-- explicit grant, and revoking PUBLIC leaves all three untouched. Any
-- SECURITY DEFINER function created in the public schema inherits this; the
-- REVOKE has to name the roles.
--
-- The function returns the full inventory of tables, columns, enums,
-- functions, policies, constraints, indexes, and storage buckets. That is a
-- map of the schema handed to anyone holding the anon key, which ships in the
-- browser bundle -- i.e. to the public.
--
-- service_role keeps EXECUTE: `npm run db:check` (scripts/db-check.ts) calls
-- this RPC with the service-role key and is the only intended caller.
--
-- Deliberately NOT touching the auth_user_*() helpers the linter flags
-- alongside this one. They are RLS policy helpers that must remain executable
-- by the roles whose policies reference them; revoking those would break row
-- access across every table.
-- ---------------------------------------------------------------------------

BEGIN;

REVOKE ALL ON FUNCTION public.__schema_inventory() FROM anon, authenticated;

-- Re-assert the intended grant so this migration is self-contained and
-- idempotent: re-running it leaves service_role able to call the function.
GRANT EXECUTE ON FUNCTION public.__schema_inventory() TO service_role;

COMMIT;
