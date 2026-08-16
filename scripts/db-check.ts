/**
 * db:check — migration ⇄ live-schema drift detector.
 *
 * Parses every migrations/NNNN_*.sql for the objects it declares (tables,
 * ALTER-added columns, enum types + values, functions, policies, named
 * constraints, indexes, storage buckets) and verifies each exists in the live
 * database. Exits non-zero (and lists the gaps) if anything is missing.
 *
 * Why this exists: Supabase's supabase_migrations.schema_migrations only tracks
 * migrations applied via the CLI/MCP, NOT ones hand-run in the SQL editor — so
 * it can't tell you what's actually applied. This does a structural diff
 * instead, which is the only trustworthy signal. See docs/BACKLOG and the
 * audit_log / admin_kind drift that motivated it.
 *
 * Connection: the service-role key (.env.local) calls the read-only
 * public.__schema_inventory() function (migrations/0028). supabase-js can't run
 * raw SQL, so the introspection lives in that SECURITY DEFINER function.
 *
 * NOTE: base columns inside CREATE TABLE bodies are not diffed individually
 * (tables are created atomically — a present table has its columns). Drift
 * realistically arrives via later ALTER ... ADD COLUMN, which IS checked.
 *
 * Run: npm run db:check
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const MIGRATIONS_DIR = "migrations";

type LiveInventory = {
  tables: string[];
  columns: string[];
  enums: string[];
  functions: string[];
  policies: string[];
  constraints: string[];
  indexes: string[];
  buckets: string[];
  /** "<table>.<trigger>". Added by 0057 — absent on a DB without it. */
  triggers?: string[];
  trigger_details?: { table: string; name: string; function: string }[];
  /** Per-policy USING / WITH CHECK. Added by 0057. */
  policy_details?: {
    name: string;
    table: string;
    cmd: string;
    qual: string;
    with_check: string;
  }[];
};

/** A policy as the migration text declares it, for the logic comparison. */
type DeclaredPolicy = {
  name: string;
  file: string;
  /** auth_user_* helpers named anywhere in its USING / WITH CHECK. */
  helpers: Set<string>;
};

/** One expected object parsed from a migration file. */
type Expected = { category: Category; name: string; file: string };

/** Strip line + block comments so commented-out DDL isn't parsed as real. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function matchAll(sql: string, re: RegExp): RegExpMatchArray[] {
  return [...sql.matchAll(re)];
}

/**
 * What one migration file declares and what it retracts.
 *
 * The retractions matter as much as the declarations. Before they were parsed,
 * db:check exited 1 on every single run with nine "missing" objects that were
 * all deliberately dropped later — three jswp_chunk_ratio values replaced by
 * 0038, five assignments.source_* columns removed by 0041, and a pg_temp
 * helper that only ever existed for the length of one session. A checker that
 * is permanently red is a checker nobody reads, which costs more than the
 * blind spot it was reporting.
 */
type Op = Expected & {
  kind: "add" | "drop" | "dropType";
  /** Byte offset in the file, so operations replay in STATEMENT order. */
  pos: number;
};

type ParsedMigration = { ops: Op[] };

/**
 * Extract every declared and retracted object from one migration file, in the
 * order the statements appear.
 *
 * Order within a file is not a nicety. `DROP POLICY IF EXISTS x; CREATE POLICY
 * x ...` is this repo's standard redefinition idiom, used in most migrations
 * that touch RLS. Collecting all creates and all drops separately and applying
 * drops second deletes exactly those policies — which silently dropped the
 * checked count from 94 to 80 and reported a clean ✓ while checking less.
 */
function parseMigration(sql: string, file: string): ParsedMigration {
  const ops: Op[] = [];
  const at = (m: RegExpMatchArray) => m.index ?? 0;
  const add = (category: Category, name: string, pos: number) =>
    ops.push({ kind: "add", category, name, file, pos });
  const drop = (category: Category, name: string, pos: number) =>
    ops.push({ kind: "drop", category, name, file, pos });

  // Tables
  for (const m of matchAll(sql, /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)) {
    add("tables", m[1], at(m));
  }

  // ALTER ... ADD/DROP COLUMN (multi-column ALTERs; one statement = up to `;`)
  for (const stmt of matchAll(sql, /ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)([\s\S]*?);/gi)) {
    const table = stmt[1];
    for (const col of matchAll(stmt[2], /ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)) {
      add("columns", `${table}.${col[1]}`, at(stmt));
    }
    for (const col of matchAll(stmt[2], /DROP COLUMN (?:IF EXISTS )?(\w+)/gi)) {
      drop("columns", `${table}.${col[1]}`, at(stmt));
    }
  }

  // Enum types + their values
  for (const m of matchAll(sql, /CREATE TYPE (\w+) AS ENUM\s*\(([\s\S]*?)\)/gi)) {
    const type = m[1];
    for (const v of matchAll(m[2], /'([^']+)'/g))
      add("enums", `${type}:${v[1]}`, at(m));
  }
  // Enum values added later
  for (const m of matchAll(
    sql,
    /ALTER TYPE (\w+) ADD VALUE (?:IF NOT EXISTS )?'([^']+)'/gi
  )) {
    add("enums", `${m[1]}:${m[2]}`, at(m));
  }

  // Enum types dropped outright (0038 replaces jswp_chunk_ratio wholesale).
  for (const m of matchAll(sql, /DROP TYPE (?:IF EXISTS )?(?:public\.)?(\w+)/gi)) {
    ops.push({ kind: "dropType", category: "enums", name: m[1], file, pos: at(m) });
  }

  // Functions. A schema qualifier other than `public.` means it is not ours to
  // check — pg_temp.map_ratio in 0038 is a session-scoped helper for a one-off
  // data backfill and is gone the moment that session ends.
  for (const m of matchAll(
    sql,
    /CREATE (?:OR REPLACE )?FUNCTION (?:(\w+)\.)?(\w+)/gi
  )) {
    const schema = m[1];
    if (schema && schema.toLowerCase() !== "public") continue;
    add("functions", m[2], at(m));
  }
  for (const m of matchAll(
    sql,
    /DROP FUNCTION (?:IF EXISTS )?(?:public\.)?(\w+)/gi
  )) {
    drop("functions", m[1], at(m));
  }

  // Policies (public + storage; checked by name)
  for (const m of matchAll(sql, /CREATE POLICY (\w+)/gi))
    add("policies", m[1], at(m));

  // Named constraints (CHECK / FK / etc. added via ALTER)
  for (const m of matchAll(sql, /ADD CONSTRAINT (\w+)/gi))
    add("constraints", m[1], at(m));

  // Explicit indexes (constraint-backed indexes aren't CREATE INDEX, so skipped)
  for (const m of matchAll(sql, /CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+)/gi)) {
    add("indexes", m[1], at(m));
  }

  // Storage buckets (id is the first quoted value after VALUES)
  for (const m of matchAll(
    sql,
    /INSERT INTO storage\.buckets[\s\S]*?VALUES\s*\(\s*'([^']+)'/gi
  )) {
    add("buckets", m[1], at(m));
  }

  /*
   * Triggers, in three flavours.
   *
   * 1. Static — `CREATE TRIGGER x ... ON public.tbl` — an exact
   *    "<table>.<trigger>" pair.
   *
   * 2. Dynamic over a literal array — 0054 attaches touch_writing by looping
   *    `FOREACH t IN ARRAY direct` and EXECUTE format('... ON public.%I', t).
   *    The table names are plain string literals in the PL/pgSQL DECLARE
   *    block, so they resolve to exact pairs too. This matters: 0054 attaches
   *    touch_writing to 14 tables, and a wildcard check that passes on one
   *    attachment would have missed thirteen silent no-ops.
   *
   * 3. Dynamic over a query — 0001 attaches set_updated_at by looping
   *    information_schema for tables carrying an `updated_at` column. That
   *    table list exists only at apply time and cannot be recovered from the
   *    file, so it is recorded as "*.<trigger>": must be attached somewhere.
   *    Weak, but honest about what the migration text actually says.
   *
   * The `\b(?!\s*\.)` guard keeps the static patterns off the dynamic ones.
   * `ON public.%I` otherwise matches with "public" as the table name — and
   * `(?!\s*\.)` alone is not enough, because the engine simply backtracks the
   * greedy `\w+` to "publi" and invents a `publi.touch_writing`.
   */
  const TRIGGER_TABLE = /\bON\s+(?:public\.)?(\w+)\b(?!\s*\.)/;
  for (const m of matchAll(
    sql,
    new RegExp(`CREATE TRIGGER\\s+(\\w+)[^;']*?${TRIGGER_TABLE.source}`, "gi")
  )) {
    add("triggers", `${m[2]}.${m[1]}`, at(m));
  }

  for (const block of matchAll(sql, /DO\s+\$\$([\s\S]*?)\$\$/g)) {
    const body = block[1];

    // `name TEXT[] := ARRAY['a', 'b', …]` from the DECLARE section.
    const arrays = new Map<string, string[]>();
    for (const decl of matchAll(
      body,
      /(\w+)\s+TEXT\s*\[\]\s*:=\s*ARRAY\s*\[([\s\S]*?)\]/gi
    )) {
      arrays.set(
        decl[1].toLowerCase(),
        matchAll(decl[2], /'([^']+)'/g).map((v) => v[1])
      );
    }

    const resolved = new Set<string>();
    for (const loop of matchAll(
      body,
      /FOREACH\s+\w+\s+IN\s+ARRAY\s+(\w+)\s+LOOP([\s\S]*?)END LOOP/gi
    )) {
      const tables = arrays.get(loop[1].toLowerCase());
      if (!tables?.length) continue;
      for (const t of matchAll(loop[2], /CREATE TRIGGER\s+(\w+)/gi)) {
        resolved.add(t[1]);
        for (const table of tables) add("triggers", `${table}.${t[1]}`, at(block));
      }
    }

    // Whatever the block creates that no array explains — flavour 3.
    for (const t of matchAll(body, /CREATE TRIGGER\s+(\w+)/gi)) {
      if (!resolved.has(t[1])) add("triggers", `*.${t[1]}`, at(block));
    }
  }

  // DROP TRIGGER ... ON tbl. The same guard excludes the `%I` form: 0054 drops
  // each trigger immediately before recreating it, so retracting there would
  // cancel out a declaration that is genuinely expected to exist.
  for (const m of matchAll(
    sql,
    new RegExp(
      `DROP TRIGGER (?:IF EXISTS )?(\\w+)\\s+${TRIGGER_TABLE.source}`,
      "gi"
    )
  )) {
    drop("triggers", `${m[2]}.${m[1]}`, at(m));
  }

  // Policies, tables and indexes dropped by later migrations.
  for (const m of matchAll(sql, /DROP POLICY (?:IF EXISTS )?(\w+)/gi)) {
    drop("policies", m[1], at(m));
  }
  for (const m of matchAll(sql, /DROP TABLE (?:IF EXISTS )?(?:public\.)?(\w+)/gi)) {
    drop("tables", m[1], at(m));
  }
  for (const m of matchAll(sql, /DROP INDEX (?:IF EXISTS )?(?:public\.)?(\w+)/gi)) {
    drop("indexes", m[1], at(m));
  }

  ops.sort((a, b) => a.pos - b.pos);
  return { ops };
}

/**
 * Policies as the migration text declares them, keyed by name.
 *
 * Only the auth_user_* helper calls are extracted, not the raw expression.
 * Postgres reformats qual/with_check on the way in — it re-quotes, reorders
 * and fully qualifies — so comparing text would be pure noise. Which helpers a
 * policy invokes is both stable across that rewriting and the thing that
 * actually determines who the policy lets in.
 */
function parsePolicies(sql: string, file: string): DeclaredPolicy[] {
  const out: DeclaredPolicy[] = [];
  for (const m of matchAll(sql, /CREATE POLICY\s+(\w+)([\s\S]*?);/gi)) {
    const helpers = new Set(
      matchAll(m[2], /\b(auth_user_\w+)\s*\(/g).map((h) => h[1])
    );
    out.push({ name: m[1], file, helpers });
  }
  return out;
}

/** Categories checked by existence. Keep in step with parseMigration. */
const CATEGORY_LABELS = {
  tables: "table",
  columns: "column",
  enums: "enum value",
  functions: "function",
  policies: "policy",
  constraints: "constraint",
  indexes: "index",
  buckets: "storage bucket",
  triggers: "trigger",
} as const;

type Category = keyof typeof CATEGORY_LABELS;

/**
 * Is a declared trigger present live?
 *
 * "*.name" means the migration attaches it dynamically and we only know the
 * name — satisfied by an attachment to any table. An exact "table.name" must
 * match exactly.
 */
function triggerPresent(declared: string, live: Set<string>): boolean {
  if (!declared.startsWith("*.")) return live.has(declared);
  const name = declared.slice(2);
  for (const l of live) {
    if (l.endsWith(`.${name}`)) return true;
  }
  return false;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc("__schema_inventory");
  if (error) {
    console.error(`✗ Could not read live schema: ${error.message}`);
    if (/__schema_inventory|function|does not exist|schema cache/i.test(error.message)) {
      console.error(
        "  → Apply migrations/0028_schema_inventory_fn.sql to this database first."
      );
    }
    process.exit(1);
  }

  const live = data as LiveInventory;

  // 0057 added triggers + policy_details. Without it we must not report every
  // declared trigger as missing — that would be the tool lying about the
  // database rather than the database being wrong.
  const hasTriggerSupport = Array.isArray(live.triggers);
  const hasPolicyLogic = Array.isArray(live.policy_details);

  const liveSets = Object.fromEntries(
    (Object.keys(CATEGORY_LABELS) as Category[]).map((k) => [
      k,
      new Set((live[k] as string[] | undefined) ?? []),
    ])
  ) as Record<Category, Set<string>>;

  // Parse every numbered migration in order.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  /*
   * Replay the migrations IN ORDER, adding on CREATE and removing on DROP.
   *
   * Order is what makes drop-then-recreate work. 0054 drops each touch_writing
   * trigger immediately before recreating it, and policies are routinely
   * redefined the same way — collecting all the creates and all the drops
   * separately would cancel those out and report a live object as unexpected.
   */
  const state = new Map<string, Expected>();
  const declaredPolicies = new Map<string, DeclaredPolicy>();
  for (const file of files) {
    const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    const { ops } = parseMigration(sql, file);

    for (const op of ops) {
      const key = `${op.category}|${op.name}`;
      if (op.kind === "add") {
        state.set(key, { category: op.category, name: op.name, file: op.file });
      } else if (op.kind === "drop") {
        state.delete(key);
      } else {
        // Enum type dropped wholesale — retract all of its values.
        for (const k of [...state.keys()]) {
          if (k.startsWith(`enums|${op.name}:`)) state.delete(k);
        }
      }
    }

    // Later files win — CREATE POLICY after a DROP is the repo's redefinition
    // idiom, so the last declaration is the current intent.
    for (const p of parsePolicies(sql, file)) declaredPolicies.set(p.name, p);
  }
  const expected = [...state.values()];

  // Already deduped — the replay above is keyed by category|name. Only the
  // 0057 guard remains: drop trigger checks when the DB predates it, rather
  // than failing every one of them.
  const checks = expected.filter(
    (e) => e.category !== "triggers" || hasTriggerSupport
  );

  const missing = checks.filter((e) =>
    e.category === "triggers"
      ? !triggerPresent(e.name, liveSets.triggers)
      : !liveSets[e.category].has(e.name)
  );

  const byCat = (cat: Category) =>
    checks.filter((c) => c.category === cat).length;

  const plural = (s: string) =>
    s.endsWith("y") ? `${s.slice(0, -1)}ies` : s.endsWith("x") ? `${s}es` : `${s}s`;

  console.log("Migration ⇄ live-schema drift check");
  console.log(`  ${files.length} migration files · ${checks.length} declared objects\n`);
  for (const cat of Object.keys(CATEGORY_LABELS) as Category[]) {
    const total = byCat(cat);
    if (total === 0) continue;
    const gone = missing.filter((m) => m.category === cat).length;
    const mark = gone === 0 ? "✓" : "✗";
    console.log(`  ${mark} ${plural(CATEGORY_LABELS[cat])}: ${total - gone}/${total}`);
  }

  /*
   * Policy LOGIC drift.
   *
   * Reported as warnings, never failures. Postgres rewrites qual/with_check on
   * the way in, and the migration text is parsed by regex, so both sides are
   * approximations — making this fatal would train people to ignore it. A
   * warning that names the policy is enough to send someone to the SQL editor,
   * which is what caught the 0050 discrepancy in the first place.
   */
  const policyWarnings: string[] = [];
  if (hasPolicyLogic) {
    for (const livePolicy of live.policy_details ?? []) {
      const declared = declaredPolicies.get(livePolicy.name);
      if (!declared) continue; // Live-only policies are the existence check's job.

      const liveHelpers = new Set(
        [
          ...(livePolicy.qual ?? "").matchAll(/\b(auth_user_\w+)\s*\(/g),
          ...(livePolicy.with_check ?? "").matchAll(/\b(auth_user_\w+)\s*\(/g),
        ].map((m) => m[1])
      );

      const onlyLive = [...liveHelpers].filter((h) => !declared.helpers.has(h));
      const onlyDeclared = [...declared.helpers].filter(
        (h) => !liveHelpers.has(h)
      );

      if (onlyLive.length === 0 && onlyDeclared.length === 0) continue;
      const parts: string[] = [];
      if (onlyLive.length) parts.push(`live-only: ${onlyLive.join(", ")}`);
      if (onlyDeclared.length)
        parts.push(`migration-only: ${onlyDeclared.join(", ")}`);
      policyWarnings.push(
        `  • ${livePolicy.table}.${livePolicy.name} — ${parts.join("; ")}  (${declared.file})`
      );
    }
  }

  const notes: string[] = [];
  if (!hasTriggerSupport) {
    notes.push(
      "  ! triggers not checked — apply migrations/0057_schema_inventory_triggers_policies.sql"
    );
  }
  if (!hasPolicyLogic) {
    notes.push(
      "  ! policy LOGIC not compared (names only) — apply migrations/0057_schema_inventory_triggers_policies.sql"
    );
  }
  if (notes.length) {
    console.log();
    for (const n of notes) console.log(n);
  }

  if (policyWarnings.length) {
    console.log(
      `\n! ${policyWarnings.length} policy/policies invoke different auth_user_* helpers live than the migration declares:`
    );
    for (const w of policyWarnings) console.log(w);
    console.log(
      "  These are not failures — Postgres rewrites policy expressions, and the\n" +
        "  migration side is regex-parsed. Read the live definition before acting."
    );
  }

  if (missing.length === 0) {
    console.log("\n✓ No drift — the live database matches every migration.");
    process.exit(0);
  }

  console.error(`\n✗ ${missing.length} declared object(s) missing from the live DB:`);
  for (const m of missing) {
    console.error(`  • [${CATEGORY_LABELS[m.category]}] ${m.name}  (${m.file})`);
  }
  console.error("\nApply the migration(s) above to this database, then re-run db:check.");
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ db:check failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
