/**
 * Supabase client factories for RLS testing.
 *
 * Reads credentials from .env.local directly (not process.env) to avoid
 * vitest's `define` block overriding them with test stubs.
 *
 * Impersonation strategy: ask the Supabase admin API for a magic-link
 * token for each user, redeem it via verifyOtp, and use the resulting
 * session's access_token in the Authorization header. Supabase itself
 * signs the session, so this works with both legacy HS256 shared-secret
 * projects and the newer JWKS / asymmetric-signing-key projects (ECC
 * P-256 etc.) without touching the project's signing material.
 *
 * Critically, this DOES NOT reset any user's password. Earlier versions
 * of this helper called auth.admin.updateUserById with a fixed test
 * password, which clobbered the seeded canonical passwords on every
 * test run and broke dev login. Don't regress to that.
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

/** Service role client — bypasses RLS entirely. Used for test setup/teardown. */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Authenticated client for a specific user, via admin-issued magic-link.
 *
 *   1. Look up the user's email (admin API).
 *   2. generateLink (type: magiclink) returns a hashed_token. No email
 *      is actually sent — the admin endpoint hands the token back to us
 *      directly.
 *   3. verifyOtp redeems the token for a real Supabase-signed session.
 *   4. Return a client carrying that session's access_token.
 *
 * Side effects on the impersonated user: a row appears in auth.flow_state
 * (magic-link tracking) and last_sign_in_at updates. Nothing destructive.
 */
export async function createUserClient(uid: string): Promise<SupabaseClient> {
  const svc = createServiceRoleClient();

  const { data: userData, error: getUserErr } =
    await svc.auth.admin.getUserById(uid);
  if (getUserErr || !userData?.user?.email) {
    throw new Error(
      `Failed to look up user ${uid}: ${getUserErr?.message ?? "no email"}`
    );
  }

  const email = userData.user.email;
  const token = await mintSession(svc, email);

  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Mint one magic link and redeem it, returning the access token.
 *
 * Retries once. Issuing a link for an email invalidates that user's previous
 * unredeemed one, so anything else minting for the same user between our
 * generate and our verify makes the redeem fail with "Email link is invalid or
 * has expired". vitest's fileParallelism is off for this suite (see
 * vitest.config.ts), which removes the known source of that; the retry covers
 * a stray concurrent run — a dev with the watcher open, say — because the
 * failure surfaces in beforeAll and takes a whole suite down with it.
 */
async function mintSession(
  svc: SupabaseClient,
  email: string,
  attempt = 1
): Promise<string> {
  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(
      `Failed to generate magic link for ${email}: ${linkErr?.message ?? "no hashed_token"}`
    );
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: verifyErr } = await authClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  const token = session?.session?.access_token;
  if (token) return token;

  const reason = verifyErr?.message ?? "no session";

  // Never retry a rate limit: a second request is exactly what it is asking us
  // not to make, and it spends budget the next test needs. Supabase throttles
  // auth endpoints per hour, and this suite mints a link per user per file.
  const rateLimited = /rate limit/i.test(reason);

  if (attempt === 1 && !rateLimited) {
    // Brief pause so a genuinely racing mint has landed before we try again.
    await new Promise((r) => setTimeout(r, 250));
    return mintSession(svc, email, 2);
  }

  throw new Error(
    rateLimited
      ? `Supabase auth rate limit hit while impersonating ${email}. This suite ` +
        `mints a magic link per user per file, so back-to-back runs can exhaust ` +
        `the hourly budget — wait a few minutes rather than re-running.`
      : `Failed to redeem magic link for ${email} after 2 attempts: ${reason}. ` +
        `Check nothing else is impersonating the same seed users concurrently.`
  );
}

/** Unauthenticated client — uses only the anon key, no user session. */
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
