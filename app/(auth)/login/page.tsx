/**
 * Login page — server component.
 *
 * - If already signed in, redirects via getRedirectPath(role).
 * - Reads ?confirmed, ?reset, ?error search params and surfaces banners.
 * - Renders the LoginForm client component for the actual form.
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  confirmed?: string;
  reset?: string;
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await getCurrentUser();
  if (profile) {
    redirect(getRedirectPath(profile.role));
  }

  const { confirmed, reset, error } = await searchParams;

  let banner: { kind: "success" | "error"; message: string } | null = null;
  if (confirmed === "1") {
    banner = { kind: "success", message: "Email confirmed. Please sign in." };
  } else if (reset === "1") {
    banner = {
      kind: "success",
      message: "Password updated. Sign in with your new password.",
    };
  } else if (error === "callback_failed") {
    banner = {
      kind: "error",
      message:
        "We couldn't verify that link. It may have expired — try signing in or requesting a new one.",
    };
  } else if (error === "access_denied") {
    banner = {
      kind: "error",
      message: "Access denied. Please sign in to continue.",
    };
  } else if (error === "orphan_account") {
    banner = {
      kind: "error",
      message:
        "Your account isn't fully set up. Please sign up again or contact your administrator.",
    };
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
          Sign in to access your assignments and tools
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            User Login
          </h2>
          <p className="text-sm text-gray-600">
            Access your district assignments and tools
          </p>
        </div>

        {banner && (
          <div
            className={`mb-4 rounded-md p-4 flex items-start gap-3 border ${
              banner.kind === "success"
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
            role="status"
          >
            {banner.kind === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                banner.kind === "success" ? "text-green-800" : "text-red-700"
              }`}
            >
              {banner.message}
            </p>
          </div>
        )}

        <LoginForm />

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href="/reset-password"
            className="text-blue-600 hover:text-blue-800"
          >
            Forgot password?
          </Link>
          <Link href="/signup" className="text-blue-600 hover:text-blue-800">
            Need an account? Sign up
          </Link>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>Need help? Contact your district administrator</p>
      </div>
    </>
  );
}
