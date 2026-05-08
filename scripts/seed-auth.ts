/**
 * seed-auth.ts — Create test auth users in Supabase
 * ─────────────────────────────────────────────────────────────────────────
 * Creates the four demo auth.users referenced by migrations/0004_seed.sql.
 * Uses the Supabase Admin API (service role key) so we can set explicit UUIDs.
 *
 * Idempotent: if a user already exists (matched by UUID), it is skipped.
 *
 * Environment variables (reads from .env.local automatically via Next.js,
 * or set them in your shell):
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (never expose to browser)
 *
 * Usage:
 *   npm run seed:auth
 *
 * Or directly:
 *   npx tsx scripts/seed-auth.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

/* ─── Load .env.local ─────────────────────────────────────────────────── */

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in .env.local or export them in your shell."
  );
  process.exit(1);
}

/* ─── Admin client ────────────────────────────────────────────────────── */

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ─── Test users (must match migrations/0004_seed.sql) ────────────────── */

interface SeedUser {
  id: string;
  email: string;
  password: string;
  label: string;
}

const SEED_USERS: readonly SeedUser[] = [
  {
    id: "6e0c3f40-7ecd-4e83-a883-14daa4b0f91b",
    email: "super@demo.test",
    password: "super-password-123",
    label: "Super Admin",
  },
  {
    id: "939c2df8-ae49-40b8-b216-bd4d6b61ea43",
    email: "teacher@demo.test",
    password: "teacher-password-123",
    label: "Teacher",
  },
  {
    id: "30d8b2f9-0bf9-4044-a254-9b8a0612b584",
    email: "alex@demo.test",
    password: "student-password-123",
    label: "Student (Alex)",
  },
  {
    id: "0dffb149-abcd-4381-9f51-aa143720a9fd",
    email: "bailey@demo.test",
    password: "student-password-123",
    label: "Student (Bailey)",
  },
];

/* ─── Main ────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log(`Seeding auth users into ${supabaseUrl}\n`);

  let created = 0;
  let skipped = 0;

  for (const user of SEED_USERS) {
    // Check if user already exists by UUID before attempting to create.
    // Supabase returns a generic 500 (not a clear "duplicate" message) when
    // creating a user with an ID that already exists, so we check first.
    const { data: existing } = await supabase.auth.admin.getUserById(user.id);

    if (existing?.user) {
      console.log(
        `  SKIP  ${user.label} (${user.email}) — already exists as ${existing.user.email}`
      );
      skipped++;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (error) {
      console.error(
        `  FAIL  ${user.label} (${user.email}) — ${error.message}`
      );
      process.exit(1);
    }

    console.log(
      `  OK    ${user.label} (${user.email}) — created as ${data.user.id}`
    );
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}.`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
