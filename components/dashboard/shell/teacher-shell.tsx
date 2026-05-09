"use client";

/**
 * Outer shell for the teacher dashboard. Owns the mobile-sidebar open
 * state — header's hamburger button toggles it; sidebar renders as a
 * sliding drawer on phones, fixed-position rail on desktop.
 *
 * Pure layout chrome — no auth state. {profile, branding} come from the
 * server layout via props.
 */

import { useState } from "react";
import { TeacherHeader } from "./teacher-header";
import { TeacherSidebar } from "./teacher-sidebar";

export type ShellProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
};

export type ShellBranding = {
  name: string;
  primaryColor: string | null;
};

export function TeacherShell({
  profile,
  branding,
  children,
}: {
  profile: ShellProfile;
  branding: ShellBranding;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherHeader
        profile={profile}
        branding={branding}
        onToggleSidebar={() => setMobileOpen((v) => !v)}
      />

      <TeacherSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
