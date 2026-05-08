/**
 * GET /logout — convenience endpoint that signs the user out and redirects
 * to /. Wired so the user can hit /logout from anywhere (URL bar, link in
 * legacy dashboard) without needing the new <LogoutButton /> component yet.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/`);
}
