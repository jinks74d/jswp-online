/**
 * Generic Supabase auth callback. Handles email-confirmation links from
 * signup (and any future OAuth/magic-link flows we wire in). Password
 * reset uses a different route — see app/(auth)/reset-password/page.tsx.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/login?confirmed=1";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=callback_failed`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
