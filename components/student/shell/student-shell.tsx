"use client";

/**
 * Outer shell for the student portal. Mirrors components/dashboard/shell
 * deliberately — the two will diverge as the writing flow grows in
 * chunks 4.2+, and a shared abstraction now would have to be torn apart
 * later. Refactor on the third usage, not the second.
 *
 * Pure layout chrome — no auth state. {profile, branding} come from the
 * server layout via props.
 */

import { useState } from "react";
import { StudentHeader } from "./student-header";
import { StudentSidebar } from "./student-sidebar";

export type StudentShellProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
};

export type StudentShellBranding = {
  name: string;
  primaryColor: string | null;
};

export function StudentShell({
  profile,
  branding,
  children,
}: {
  profile: StudentShellProfile;
  branding: StudentShellBranding;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentHeader
        profile={profile}
        branding={branding}
        onToggleSidebar={() => setMobileOpen((v) => !v)}
      />

      <StudentSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
