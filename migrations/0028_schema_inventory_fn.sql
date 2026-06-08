-- ---------------------------------------------------------------------------
-- 0028_schema_inventory_fn.sql
--
-- Read-only introspection function backing `npm run db:check` (scripts/
-- db-check.ts). It returns the live schema's object inventory as JSON so the
-- drift checker can diff it against what the migrations declare — catching a
-- migration that was never applied (the audit_log / admin_kind class of bug).
--
-- SECURITY DEFINER so it can read pg_catalog + the storage schema; EXECUTE is
-- locked to service_role (the db:check script uses the service-role key), so it
-- is NOT callable by anon/authenticated clients.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.__schema_inventory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tables', (SELECT coalesce(jsonb_agg(table_name ORDER BY table_name), '[]'::jsonb)
               FROM information_schema.tables
               WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    'columns', (SELECT coalesce(jsonb_agg(table_name || '.' || column_name
                         ORDER BY table_name, column_name), '[]'::jsonb)
                FROM information_schema.columns WHERE table_schema = 'public'),
    'enums', (SELECT coalesce(jsonb_agg(t.typname || ':' || e.enumlabel
                       ORDER BY t.typname, e.enumsortorder), '[]'::jsonb)
              FROM pg_type t
              JOIN pg_enum e ON e.enumtypid = t.oid
              JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public'),
    'functions', (SELECT coalesce(jsonb_agg(DISTINCT p.proname), '[]'::jsonb)
                  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public'),
    'policies', (SELECT coalesce(jsonb_agg(DISTINCT policyname), '[]'::jsonb)
                 FROM pg_policies WHERE schemaname IN ('public', 'storage')),
    'constraints', (SELECT coalesce(jsonb_agg(DISTINCT c.conname), '[]'::jsonb)
                    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
                    WHERE n.nspname = 'public'),
    'indexes', (SELECT coalesce(jsonb_agg(indexname ORDER BY indexname), '[]'::jsonb)
                FROM pg_indexes WHERE schemaname = 'public'),
    'buckets', (SELECT coalesce(jsonb_agg(id ORDER BY id), '[]'::jsonb)
                FROM storage.buckets)
  );
$$;

REVOKE ALL ON FUNCTION public.__schema_inventory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__schema_inventory() TO service_role;

COMMIT;
