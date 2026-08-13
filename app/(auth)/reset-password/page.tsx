import type { Metadata } from "next";
/**
 * Reset-password page — server component.
 *
 * Two states in one route:
 *  1. Default → render the request-an-email form.
 *  2. `?recovery=1` WITH a session → render the new-password form.
 *
 * This page deliberately does NOT exchange the recovery code. It used to,
 * and that was the bug: `exchangeCodeForSession` succeeds against Supabase
 * (burning the one-time code) but its session cookies are dropped, because a
 * Server Component cannot write cookies — lib/supabase/server.ts swallows the
 * failure by design so ordinary reads don't crash. The page then rendered a
 * password form backed by no session, and saving failed with "Auth session
 * missing". Retrying could not help: the code was already spent.
 *
 * The exchange now happens in app/auth/callback/route.ts, which can write
 * cookies, and redirects back here with ?recovery=1.
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";
import { RequestForm } from "./request-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ code?: string; recovery?: string }>;

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { code, recovery } = await searchParams;

  // Recovery emails sent before this route moved still point straight here
  // with a ?code. Hand those to the callback so they keep working.
  if (code) {
    const next = encodeURIComponent("/reset-password?recovery=1");
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${next}`);
  }

  let mode: "request" | "new-password" = "request";
  let exchangeError: string | undefined;

  if (recovery === "1") {
    // The callback has already exchanged the code; a session here means the
    // link was good. Without one it expired, was already used, or was opened
    // in a different browser from the one that requested it.
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      mode = "new-password";
    } else {
      exchangeError =
        "That reset link is invalid or has expired. Request a new one below.";
    }
  }

  return (
    <>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/assets/logos/JSWPOnlineLogo-p-500.png"
            alt="JSWP Online"
            width={400}
            height={160}
            priority
          />
        </div>
        <p className="text-gray-600">
          {mode === "new-password"
            ? "Choose a new password"
            : "Reset your password"}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-xl p-8">
        {mode === "new-password" ? (
          <NewPasswordForm />
        ) : (
          <RequestForm initialError={exchangeError} />
        )}

        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Back to sign in
          </Link>
        </div>
      </div>
    </>
  );
}
