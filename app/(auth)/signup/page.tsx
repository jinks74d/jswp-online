/**
 * Signup page — server component.
 *
 * Creates an auth.users row only. user_profiles assignment to a district
 * happens later via admin approval (separate ticket).
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { profile } = await getCurrentUser();
  if (profile) {
    redirect(getRedirectPath(profile.role));
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
        <p className="text-gray-600">Create your account</p>
      </div>

      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign up</h2>
          <p className="text-sm text-gray-600">
            We&apos;ll send you a confirmation email to verify your address.
          </p>
        </div>

        <SignupForm />

        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </>
  );
}
