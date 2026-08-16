-- ---------------------------------------------------------------------------
-- 0059_revoke_schema_inventory_from_api_roles.sql
--
-- URGENT. Re-applies what 0046 was written to do and, as of 2026-08-16, had
-- never actually done on the live project.
--
-- Probed 2026-08-16 with the anon key from .env.local (role claim: "anon",
-- and confirmed genuinely anon — it reads zero rows from user_profiles):
--
--     await anon.rpc('__schema_inventory')   -->  ALLOWED
--
-- It returned all 94 policies with full `qual` and `with_check`, 30 function
-- names, and 42 triggers. The anon key ships in the browser bundle, so that
-- payload is public.
--
-- WHY 0046 DID NOT TAKE
-- Nothing in migrations/ ever DROPs this function, and CREATE OR REPLACE
-- preserves a function's ACL. So a revoke that had ever run would still be in
-- force. It is not, which means 0046 — whose body is nothing but REVOKE and
-- GRANT — was never applied. It contains no CREATE statement of any kind, so
-- `npm run db:check` cannot see it: the checker has categories for tables,
-- columns, enums, functions, policies, constraints, indexes, buckets and (as
-- of 0057) triggers, and NO category for privileges. It reported "no drift"
-- against a database missing this migration entirely.
--
-- 0057 made the exposure materially worse rather than causing it: before
-- 0057 an anon caller got policy NAMES, after it they get every policy's
-- USING and WITH CHECK expression. 0057 also repeated 0028's mistake of
-- revoking only FROM PUBLIC, which does nothing here — Supabase ships
-- ALTER DEFAULT PRIVILEGES granting EXECUTE ON FUNCTIONS in the public schema
-- to anon, authenticated and service_role, so each role holds its OWN explicit
-- grant at CREATE time and revoking the PUBLIC pseudo-role leaves all three
-- untouched. The REVOKE has to name the roles. Any future SECURITY DEFINER
-- function created in `public` inherits this trap.
--
-- Idempotent, and safe to run more than once.
-- ---------------------------------------------------------------------------

BEGIN;

REVOKE ALL ON FUNCTION public.__schema_inventory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.__schema_inventory() FROM anon, authenticated;

-- service_role remains the only intended caller: scripts/db-check.ts uses the
-- service-role key and is the only thing that invokes this RPC.
GRANT EXECUTE ON FUNCTION public.__schema_inventory() TO service_role;

COMMIT;
