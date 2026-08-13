/**
 * Generic Supabase auth callback: signup email confirmation, password
 * recovery, and any future OAuth/magic-link flow.
 *
 * Everything that needs a session must land HERE rather than on a page. The
 * code exchange is what writes the session cookies, and only route handlers
 * and server actions may write cookies in the App Router — a Server Component
 * doing the same exchange burns the one-time code and silently keeps no
 * session (see lib/supabase/server.ts, whose setAll swallows exactly that).
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Only same-origin paths may be redirected to. `//evil.com` would otherwise
 * be read by the browser as protocol-relative and leave the site.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/login?confirmed=1";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/login?confirmed=1";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
