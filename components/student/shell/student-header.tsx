"use client";

/**
 * Top bar: hamburger (mobile only), district name in brand color (link
 * to /student), and the user menu on the right. Mirrors the teacher
 * header — see student-shell.tsx for the divergence rationale.
 */

import Link from "next/link";
import { Menu } from "lucide-react";
import { StudentUserMenu } from "./user-menu";
import type {
  StudentShellProfile,
  StudentShellBranding,
} from "./student-shell";

export function StudentHeader({
  profile,
  branding,
  onToggleSidebar,
}: {
  profile: StudentShellProfile;
  branding: StudentShellBranding;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="h-16 flex items-center justify-between px-4 md:pl-64">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-700 hover:bg-gray-100"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            href="/student"
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--district-primary)" }}
          >
            {branding.name}
          </Link>
        </div>

        <StudentUserMenu profile={profile} />
      </div>
    </header>
  );
}
