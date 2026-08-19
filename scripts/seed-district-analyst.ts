/**
 * seed-district-analyst.ts — Provision a cross-district analytics viewer.
 * ─────────────────────────────────────────────────────────────────────────
 * Creates (or resets) a `district_analyst` account and grants it read access
 * to one or more districts. Migration 0061 must be applied first.
 *
 * There is deliberately no UI for this yet (docs/BACKLOG.md, "Admin UI for
 * cross-district analytics grants"). `district_access_grants` carries no
 * INSERT policy at all, so the service role is the only writer — which is why
 * this is a script and not something a super admin can do in the app.
 *
 * Idempotent: re-running resets the password, re-asserts the profile, and
 * re-upserts the grants. Re-granting an existing pair is a no-op.
 *
 * Usage:
 *   # List the districts available to grant, with their ids:
 *   npx tsx scripts/seed-district-analyst.ts
 *
 *   # Provision an analyst over specific districts (ids or subdomains):
 *   npx tsx scripts/seed-district-analyst.ts analyst@example.com <d1> <d2> …
 *
 * The account lands on /analytics at the APEX domain after sign-in — not on a
 * district subdomain. An analyst spans several districts, so the subdomain
 * mismatch check in lib/actions/auth.ts deliberately skips this role.
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

/** Fallback only. Real accounts should pass --password. */
const DEFAULT_PASSWORD = "Test123!";

type Options = {
  password: string;
  firstName: string;
  lastName: string;
  force: boolean;
};

/**
 * Pull `--name "First Last"`, `--password …` and `--force` out of argv,
 * returning them plus the positional arguments that remain.
 *
 * Hand-rolled rather than a flag library: adding a dependency for four
 * options would need approval per CLAUDE.md §15.1, and this is a one-file
 * script.
 */
function parseArgs(argv: readonly string[]): {
  positionals: string[];
  options: Options;
} {
  const positionals: string[] = [];
  let password = DEFAULT_PASSWORD;
  let name = "District Analyst";
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--password") {
      password = argv[++i] ?? DEFAULT_PASSWORD;
    } else if (arg === "--name") {
      name = argv[++i] ?? name;
    } else {
      positionals.push(arg);
    }
  }

  // Everything before the last token is the given name, so "Ana Maria Cruz"
  // keeps "Ana Maria" together rather than dropping the middle name.
  const parts = name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  const firstName = parts.slice(0, parts.length > 1 ? -1 : 1).join(" ");

  return { positionals, options: { password, firstName, lastName, force } };
}

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

type DistrictRow = { id: string; name: string; subdomain: string | null };

async function loadDistricts(): Promise<DistrictRow[]> {
  const { data, error } = await supabase
    .from("districts")
    .select("id, name, subdomain")
    .order("name");
  if (error) throw new Error(`Failed to list districts: ${error.message}`);
  return data ?? [];
}

async function listMode(): Promise<void> {
  const districts = await loadDistricts();

  console.log(`Districts in ${supabaseUrl}\n`);
  for (const d of districts) {
    console.log(`  ${d.id}  ${(d.subdomain ?? "-").padEnd(16)}  ${d.name}`);
  }
  console.log(`\n  ${districts.length} total\n`);
  console.log(
    "To provision an analyst over some of them:\n" +
      "  npx tsx scripts/seed-district-analyst.ts analyst@example.com <id-or-subdomain> …"
  );
}

async function provision(
  email: string,
  wanted: string[],
  options: Options
): Promise<void> {
  const districts = await loadDistricts();

  // Accept either a uuid or a subdomain, so the command is typeable from the
  // list above without copying uuids around.
  const resolved: DistrictRow[] = [];
  for (const token of wanted) {
    const hit = districts.find(
      (d) => d.id === token || d.subdomain === token.toLowerCase()
    );
    if (!hit) {
      console.error(`  FAIL  no district matches "${token}"`);
      process.exit(1);
    }
    resolved.push(hit);
  }

  console.log(`Provisioning analyst in ${supabaseUrl}\n`);

  // 1. Create or reset the auth user.
  let userId: string;
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: options.password,
      email_confirm: true,
    });
    if (error) {
      console.error(`  FAIL  update auth user — ${error.message}`);
      process.exit(1);
    }
    userId = existing.id;
    console.log(`  UPDATE auth user ${email} — password reset (${userId})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: options.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`  FAIL  create auth user — ${error?.message}`);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`  OK    auth user ${email} — created (${userId})`);
  }

  // 2a. Refuse to convert someone who already holds a different role.
  //     Without this, pointing the script at a working teacher's address
  //     silently changes their role and strands them out of /dashboard — a
  //     one-character typo in an email away, and invisible until they try to
  //     sign in. --force is there for a deliberate re-role.
  const { data: current } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (
    current &&
    current.role !== "district_analyst" &&
    !options.force
  ) {
    console.error(
      `  FAIL  ${email} already exists as "${current.role}". Converting them ` +
        `would revoke that access.\n` +
        `        Re-run with --force if that is genuinely intended.`
    );
    process.exit(1);
  }

  // 2. Profile. district_id is NOT NULL, so the analyst needs a home district
  //    even though it grants them nothing — the first granted district is the
  //    natural choice. school_id is null, which is legal only because 0061 §2
  //    relaxed the CHECK from 0001.
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      role: "district_analyst",
      district_id: resolved[0].id,
      school_id: null,
      first_name: options.firstName,
      last_name: options.lastName,
      email,
      active: true,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    console.error(`  FAIL  upsert profile — ${profileErr.message}`);
    process.exit(1);
  }
  console.log(
    `  OK    profile — ${options.firstName} ${options.lastName}, ` +
      `district_analyst (home: ${resolved[0].name})`
  );

  // 3. The grants. These, not the profile column, are what the gate reads.
  //    granted_by points at the analyst themselves here because a script has
  //    no acting super admin; the app's grant action records the real one.
  const { error: grantErr } = await supabase
    .from("district_access_grants")
    .upsert(
      resolved.map((d) => ({
        user_id: userId,
        district_id: d.id,
        granted_by: userId,
      })),
      { onConflict: "user_id,district_id", ignoreDuplicates: true }
    );
  if (grantErr) {
    console.error(`  FAIL  upsert grants — ${grantErr.message}`);
    process.exit(1);
  }
  for (const d of resolved) {
    console.log(`  OK    grant — ${d.name}`);
  }

  console.log(
    `\nDone. Sign in at the APEX domain (not a district subdomain):\n` +
      `  ${email} / ${options.password}\n` +
      `Lands on /analytics with a switcher over ${resolved.length} district(s).`
  );
}

async function main(): Promise<void> {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [email, ...rest] = positionals;

  if (!email) {
    await listMode();
    return;
  }
  if (rest.length === 0) {
    console.error(
      "Give at least one district (id or subdomain) to grant.\n" +
        "  npx tsx scripts/seed-district-analyst.ts <email> <district> … " +
        '--name "First Last" --password "…"\n' +
        "Run with no arguments to list the available districts."
    );
    process.exit(1);
  }
  await provision(email, rest, options);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
