/**
 * Status landing for users who are signed in but have no user_profiles
 * row yet. Reads their signup_requests row (RLS-scoped — user can SELECT
 * their own) and renders pending / approved / denied accordingly.
 */

import { redirect } from "next/navigation";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If the profile got created between login and this render (e.g. admin
  // approved while the user had this tab open), send them to their portal.
  if (profile) {
    redirect(getRedirectPath(profile.role));
  }

  // Read the user's signup_request via RLS (auth_user_id = auth.uid()).
  const supabase = await createServerClient();
  const { data: sr } = await supabase
    .from("signup_requests")
    .select("status, denial_reason, first_name, created_at, decided_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!sr) {
    // No request and no profile — orphan auth user. Get them out cleanly.
    await supabase.auth.signOut();
    redirect("/login?error=orphan_account");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8 space-y-4">
        <StatusHeader status={sr.status} />
        <Body sr={sr} />
        <div className="pt-2">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

function StatusHeader({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Approved</h1>
        </div>
      );
    case "denied":
      return (
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900">Not approved</h1>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Pending review</h1>
        </div>
      );
  }
}

function Body({
  sr,
}: {
  sr: {
    status: string;
    denial_reason: string | null;
    first_name: string;
    created_at: string;
    decided_at: string | null;
  };
}) {
  if (sr.status === "approved") {
    return (
      <p className="text-sm text-gray-600">
        Your account is approved. Refresh this page to enter the app.
      </p>
    );
  }
  if (sr.status === "denied") {
    return (
      <>
        <p className="text-sm text-gray-600">
          Hi {sr.first_name}, an administrator reviewed your application but
          couldn&apos;t approve it.
        </p>
        {sr.denial_reason && (
          <div className="text-sm text-gray-700 bg-gray-50 border-l-4 border-gray-300 px-4 py-3">
            <strong>Reason:</strong> {sr.denial_reason}
          </div>
        )}
        <p className="text-sm text-gray-600">
          If you have questions, reach out to your district administrator.
        </p>
      </>
    );
  }
  return (
    <p className="text-sm text-gray-600">
      Hi {sr.first_name}, your application is being reviewed by an
      administrator. We&apos;ll email you when it&apos;s approved or denied.
    </p>
  );
}
