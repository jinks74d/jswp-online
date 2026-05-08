/**
 * Signup page — server component. Creates an auth.users row + a
 * signup_requests row (status='pending'). Admin reviews under
 * /admin/signups and approves or denies, which is when user_profiles is
 * actually written.
 */

import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignupForm, type SchoolOption } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { profile } = await getCurrentUser();
  if (profile) {
    redirect(getRedirectPath(profile.role));
  }

  // Read the resolved district from the middleware header. If we're on a
  // real subdomain we can pre-populate the school dropdown; on apex the
  // user will be reviewed by super_admin and assigned district + school
  // at approval time.
  const h = await headers();
  const districtId = h.get("x-jswp-district-id");
  const districtName = h.get("x-jswp-district-name");

  let schools: SchoolOption[] = [];
  if (districtId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("schools")
      .select("id, name")
      .eq("district_id", districtId)
      .eq("active", true)
      .order("name");
    schools = (data ?? []).map((s) => ({ id: s.id, name: s.name }));
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
            {districtName
              ? `Apply for an account at ${districtName}. We'll send you a confirmation email; an administrator will review your request.`
              : "Apply for an account. We'll send you a confirmation email; an administrator will review your request."}
          </p>
        </div>

        <SignupForm schools={schools} />

        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </>
  );
}
