/**
 * Verifies auth tokens from emails WE send (password reset, POC invite).
 *
 * Distinct from /auth/callback, which handles the PKCE `?code` produced when
 * the @supabase/ssr client itself initiates a flow (signup confirmation).
 * Links built from `admin.generateLink` are implicit-flow and return their
 * tokens in a hash fragment the server can never see — so those carry a
 * `token_hash` here instead and are verified server-side, where the resulting
 * cookies actually stick. See lib/auth-links.ts.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isAuthLinkType, safeNext } from "@/lib/auth-links";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !isAuthLinkType(type)) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // Expired, already used, or tampered with. The destination pages phrase
    // this for the user; don't leak which of the three it was.
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
