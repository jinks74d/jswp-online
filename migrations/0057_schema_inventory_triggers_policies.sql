-- ---------------------------------------------------------------------------
-- 0057_schema_inventory_triggers_policies.sql
--
-- Extends public.__schema_inventory() (0028) with the two blind spots
-- docs/BACKLOG.md records against `npm run db:check`.
--
-- 1. TRIGGERS were not emitted at all, so nothing in the repo could verify
--    trigger ATTACHMENT. Confirmed 2026-08-12 while verifying 0054: the four
--    trg_touch_writing_* FUNCTIONS were checkable, but the touch_writing
--    TRIGGERS that attach them were not, from any tooling here. A trigger that
--    was never attached looks identical to a working one — the function exists,
--    db:check reports ✓, and nothing fires.
--
-- 2. POLICIES were emitted as NAMES ONLY, so a policy whose USING/WITH CHECK
--    logic is wrong — or simply does not match the migration text that
--    supposedly created it — passed with a clean ✓. Not hypothetical: found
--    2026-08-05 reviewing 0050, where the committed
--    assignment_class_periods_write constrains only assignment_id while the
--    LIVE database also enforces a period-side check. db:check reported 94/94
--    throughout. Emitting cmd/qual/with_check lets the checker compare the
--    logic, not just the label.
--
-- Purely additive: existing keys are unchanged, so an older db-check.ts keeps
-- working against a database carrying this migration.
--
-- Still SECURITY DEFINER (needs pg_catalog) with EXECUTE locked to
-- service_role, exactly as 0028 left it.
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
                FROM storage.buckets),

    -- NEW ------------------------------------------------------------------

    -- "<table>.<trigger>" pairs, matching the existing columns convention.
    -- tgisinternal filters the system triggers Postgres creates to enforce FK
    -- constraints, which are not ours to declare and would be pure noise.
    'triggers', (SELECT coalesce(jsonb_agg(c.relname || '.' || t.tgname
                          ORDER BY c.relname, t.tgname), '[]'::jsonb)
                 FROM pg_trigger t
                 JOIN pg_class c ON c.oid = t.tgrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND NOT t.tgisinternal),

    -- Same set with the function each one calls, for the report. A trigger
    -- pointing at the wrong function is a distinct failure from a missing one.
    'trigger_details', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                            'table', c.relname,
                            'name', t.tgname,
                            'function', p.proname
                          ) ORDER BY c.relname, t.tgname), '[]'::jsonb)
                        FROM pg_trigger t
                        JOIN pg_class c ON c.oid = t.tgrelid
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        JOIN pg_proc p ON p.oid = t.tgfoid
                        WHERE n.nspname = 'public' AND NOT t.tgisinternal),

    -- Per-policy logic. qual is the USING expression, with_check the WITH
    -- CHECK one; Postgres returns them already normalized, which is why the
    -- checker compares the set of function calls inside them rather than raw
    -- text (see scripts/db-check.ts).
    'policy_details', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                           'name', policyname,
                           'table', tablename,
                           'cmd', cmd,
                           'qual', coalesce(qual, ''),
                           'with_check', coalesce(with_check, '')
                         ) ORDER BY tablename, policyname), '[]'::jsonb)
                       FROM pg_policies WHERE schemaname IN ('public', 'storage'))
  );
$$;

REVOKE ALL ON FUNCTION public.__schema_inventory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__schema_inventory() TO service_role;

COMMIT;
