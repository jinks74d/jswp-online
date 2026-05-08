/**
 * Reset-password page — server component.
 *
 * Two states in one route:
 *  1. No `?code` param → render the request-an-email form.
 *  2. `?code` present → exchange the PKCE code for a recovery session,
 *     then render the new-password form.
 *
 * If the exchange fails (expired link, etc.) we fall back to the
 * request form with an inline error.
 */

import Image from "next/image";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";
import { RequestForm } from "./request-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ code?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { code } = await searchParams;

  let mode: "request" | "new-password" = "request";
  let exchangeError: string | undefined;

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      exchangeError =
        "That reset link is invalid or has expired. Request a new one below.";
    } else {
      mode = "new-password";
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
