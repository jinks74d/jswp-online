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

// Note: the super-admin account (raymond@farsidedev.com, UUID
// 6e0c3f40-…) is a real production user managed via the auth UI / the
// /reset-password flow — intentionally NOT seeded here. Adding it would
// put the live password in source control.

const SEED_USERS: readonly SeedUser[] = [
  {
    id: "939c2df8-ae49-40b8-b216-bd4d6b61ea43",
    email: "teacher@demo.test",
    password: "Teacher1!",
    label: "Teacher",
  },
  {
    id: "30d8b2f9-0bf9-4044-a254-9b8a0612b584",
    email: "alex@demo.test",
    password: "Student1!",
    label: "Student (Alex)",
  },
  {
    id: "0dffb149-abcd-4381-9f51-aa143720a9fd",
    email: "bailey@demo.test",
    password: "Student1!",
    label: "Student (Bailey)",
  },
  {
    id: "f9df5319-c68a-4ee2-8744-98da1b0387d9",
    email: "john.doe@student.edu",
    password: "iSqAXnaU6fZ8",
    label: "Student (John Doe)",
  },
  {
    id: "0edce9e5-c856-4fae-ad01-3feff206407d",
    email: "jane.smith@student.edu",
    password: "n71QuaqqO63M",
    label: "Student (Jane Smith)",
  },
  {
    id: "537671c6-9c8c-4846-992c-91ed2532bb85",
    email: "mike.johnson@student.edu",
    password: "sW7tPpQTHu5b",
    label: "Student (Mike Johnson)",
  },
  {
    id: "cb7e03d2-40a2-4eda-b9be-825f565490bf",
    email: "sarah.williams@student.edu",
    password: "L6UGHHEGNzF8",
    label: "Student (Sarah Williams)",
  },
];

/* ─── Main ────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log(`Seeding auth users into ${supabaseUrl}\n`);

  let created = 0;
  let updated = 0;

  for (const user of SEED_USERS) {
    // Check if user already exists by UUID. If so, force-update the email
    // and password to the canonical values so the documented credentials
    // always work — even if the row drifted (manual reset, earlier seed
    // with different password, etc.).
    const { data: existing } = await supabase.auth.admin.getUserById(user.id);

    if (existing?.user) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (error) {
        console.error(
          `  FAIL  ${user.label} (${user.email}) — update: ${error.message}`
        );
        process.exit(1);
      }

      console.log(
        `  UPDATE ${user.label} (${user.email}) — password + email reset`
      );
      updated++;
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

  console.log(`\nDone. Created: ${created}, Updated: ${updated}.`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
