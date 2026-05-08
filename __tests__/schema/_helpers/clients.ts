/**
 * Supabase client factories for RLS testing.
 *
 * Reads credentials from .env.local directly (not process.env) to avoid
 * vitest's `define` block overriding them with test stubs.
 *
 * Uses the admin API to update user passwords and sign in as each user
 * to obtain real session tokens. This avoids needing the JWT secret.
 *
 * Required env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

/* ─── Load env from file (bypasses vitest define overrides) ───────────── */

const env = config({ path: resolve(process.cwd(), ".env.local") }).parsed!;

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing one of NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
      "or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const RLS_TEST_PASSWORD = "rls-test-password-7x9Q!";

/** Service role client — bypasses RLS entirely. Used for test setup/teardown. */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Authenticated client for a specific user.
 * Sets the user's password via admin API, signs in to get a real session
 * token, and returns a client with that token in the Authorization header.
 */
export async function createUserClient(uid: string): Promise<SupabaseClient> {
  const svc = createServiceRoleClient();

  // Set a known password for this user
  const { error: updateErr } = await svc.auth.admin.updateUserById(uid, {
    password: RLS_TEST_PASSWORD,
  });
  if (updateErr) {
    throw new Error(`Failed to set password for ${uid}: ${updateErr.message}`);
  }

  // Look up the user's email
  const { data: userData, error: getUserErr } =
    await svc.auth.admin.getUserById(uid);
  if (getUserErr || !userData?.user?.email) {
    throw new Error(`Failed to get user ${uid}: ${getUserErr?.message}`);
  }

  // Sign in to get a real access token
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInErr } =
    await authClient.auth.signInWithPassword({
      email: userData.user.email,
      password: RLS_TEST_PASSWORD,
    });
  if (signInErr || !session?.session?.access_token) {
    throw new Error(
      `Failed to sign in as ${userData.user.email}: ${signInErr?.message}`
    );
  }

  // Return a client that uses this access token
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Unauthenticated client — uses only the anon key, no user session. */
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
