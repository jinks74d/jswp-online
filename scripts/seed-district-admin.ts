/**
 * seed-district-admin.ts — Seed a district_admin test account.
 * ─────────────────────────────────────────────────────────────────────────
 * Creates (or resets) districtadmin1@district1.edu as a district_admin of the
 * Demo LACOE District, with a known password and confirmed email so it logs in
 * immediately. Uses the Supabase Admin API (service role key).
 *
 * Idempotent: re-running resets the password + re-asserts the profile row.
 *
 * Usage:  npx tsx scripts/seed-district-admin.ts
 */

import { createClient, type User } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ─── Account to seed ─────────────────────────────────────────────────── */

const DISTRICT_ID = "00000000-0000-0000-0000-000000000001"; // Demo LACOE District
const EMAIL = "districtadmin1@district1.edu";
const PASSWORD = "Test123!";
const FIRST_NAME = "District";
const LAST_NAME = "Admin One";

/** Find an existing auth user by email (paginates through the admin list). */
async function findUserByEmail(email: string): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`Seeding district admin into ${supabaseUrl}\n`);

  // 1. Create or reset the auth user.
  let userId: string;
  const existing = await findUserByEmail(EMAIL);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error(`  FAIL  update auth user — ${error.message}`);
      process.exit(1);
    }
    userId = existing.id;
    console.log(`  UPDATE auth user ${EMAIL} — password reset (${userId})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`  FAIL  create auth user — ${error?.message}`);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`  OK    auth user ${EMAIL} — created (${userId})`);
  }

  // 2. Upsert the district_admin profile (school_id null — district scope).
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      role: "district_admin",
      district_id: DISTRICT_ID,
      school_id: null,
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      email: EMAIL,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    console.error(`  FAIL  upsert profile — ${profileErr.message}`);
    process.exit(1);
  }
  console.log(`  OK    profile — district_admin @ Demo LACOE District`);

  console.log(`\nDone. Login: ${EMAIL} / ${PASSWORD}`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
