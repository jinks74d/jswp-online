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
};

/** One expected object parsed from a migration file. */
type Expected = { category: keyof LiveInventory; name: string; file: string };

/** Strip line + block comments so commented-out DDL isn't parsed as real. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function matchAll(sql: string, re: RegExp): RegExpMatchArray[] {
  return [...sql.matchAll(re)];
}

/** Extract every declared object from one migration file. */
function parseMigration(sql: string, file: string): Expected[] {
  const out: Expected[] = [];
  const add = (category: keyof LiveInventory, name: string) =>
    out.push({ category, name, file });

  // Tables
  for (const m of matchAll(sql, /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)) {
    add("tables", m[1]);
  }

  // ALTER ... ADD COLUMN (handles multi-column ALTERs; one statement = up to `;`)
  for (const stmt of matchAll(sql, /ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)([\s\S]*?);/gi)) {
    const table = stmt[1];
    for (const col of matchAll(stmt[2], /ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)) {
      add("columns", `${table}.${col[1]}`);
    }
  }

  // Enum types + their values
  for (const m of matchAll(sql, /CREATE TYPE (\w+) AS ENUM\s*\(([\s\S]*?)\)/gi)) {
    const type = m[1];
    for (const v of matchAll(m[2], /'([^']+)'/g)) add("enums", `${type}:${v[1]}`);
  }
  // Enum values added later
  for (const m of matchAll(
    sql,
    /ALTER TYPE (\w+) ADD VALUE (?:IF NOT EXISTS )?'([^']+)'/gi
  )) {
    add("enums", `${m[1]}:${m[2]}`);
  }

  // Functions
  for (const m of matchAll(sql, /CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?(\w+)/gi)) {
    add("functions", m[1]);
  }

  // Policies (public + storage; checked by name)
  for (const m of matchAll(sql, /CREATE POLICY (\w+)/gi)) add("policies", m[1]);

  // Named constraints (CHECK / FK / etc. added via ALTER)
  for (const m of matchAll(sql, /ADD CONSTRAINT (\w+)/gi)) add("constraints", m[1]);

  // Explicit indexes (constraint-backed indexes aren't CREATE INDEX, so skipped)
  for (const m of matchAll(sql, /CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+)/gi)) {
    add("indexes", m[1]);
  }

  // Storage buckets (id is the first quoted value after VALUES)
  for (const m of matchAll(
    sql,
    /INSERT INTO storage\.buckets[\s\S]*?VALUES\s*\(\s*'([^']+)'/gi
  )) {
    add("buckets", m[1]);
  }

  return out;
}

const CATEGORY_LABELS: Record<keyof LiveInventory, string> = {
  tables: "table",
  columns: "column",
  enums: "enum value",
  functions: "function",
  policies: "policy",
  constraints: "constraint",
  indexes: "index",
  buckets: "storage bucket",
};

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
  const liveSets = Object.fromEntries(
    (Object.keys(CATEGORY_LABELS) as (keyof LiveInventory)[]).map((k) => [
      k,
      new Set(live[k] ?? []),
    ])
  ) as Record<keyof LiveInventory, Set<string>>;

  // Parse every numbered migration in order.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  const expected: Expected[] = [];
  for (const file of files) {
    const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    expected.push(...parseMigration(sql, file));
  }

  // Dedupe (later migrations may re-declare, e.g. CREATE OR REPLACE).
  const seen = new Set<string>();
  const checks = expected.filter((e) => {
    const k = `${e.category}|${e.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const missing = checks.filter((e) => !liveSets[e.category].has(e.name));

  const byCat = (cat: keyof LiveInventory) =>
    checks.filter((c) => c.category === cat).length;

  const plural = (s: string) =>
    s.endsWith("y") ? `${s.slice(0, -1)}ies` : s.endsWith("x") ? `${s}es` : `${s}s`;

  console.log("Migration ⇄ live-schema drift check");
  console.log(`  ${files.length} migration files · ${checks.length} declared objects\n`);
  for (const cat of Object.keys(CATEGORY_LABELS) as (keyof LiveInventory)[]) {
    const total = byCat(cat);
    if (total === 0) continue;
    const gone = missing.filter((m) => m.category === cat).length;
    const mark = gone === 0 ? "✓" : "✗";
    console.log(`  ${mark} ${plural(CATEGORY_LABELS[cat])}: ${total - gone}/${total}`);
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
