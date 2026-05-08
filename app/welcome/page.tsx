/**
 * Generic post-login landing for roles whose v2 portal isn't built yet
 * (teachers → Phase 3, students → Phase 4). Confirms sign-in worked and
 * gives a logout button. Replaced by real role-specific routes later.
 */

import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const profile = await requireUser();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {profile.first_name ?? profile.email}
        </h1>
        <p className="text-sm text-gray-600">
          You&apos;re signed in as{" "}
          <span className="font-medium text-gray-900">{profile.role}</span>.
        </p>
        <p className="text-sm text-gray-600">
          Your portal is still being built. Once it ships, this page will
          redirect you straight to it. Until then, you can sign out below.
        </p>
        <div className="pt-2">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
