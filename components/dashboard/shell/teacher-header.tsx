"use client";

/**
 * Top bar: hamburger (mobile only), district name in brand color (link
 * to /dashboard), and the user menu on the right. Sidebar's open/close
 * is owned by the parent shell.
 */

import Link from "next/link";
import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";
import type { ShellProfile, ShellBranding } from "./teacher-shell";

export function TeacherHeader({
  profile,
  branding,
  onToggleSidebar,
}: {
  profile: ShellProfile;
  branding: ShellBranding;
  onToggleSidebar: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-20 border-b shadow-sm"
      style={{
        backgroundColor: "var(--dash-brand-tint)",
        borderColor: "var(--dash-brand-edge)",
      }}
    >
      <div className="h-16 flex items-center justify-between px-4 md:pl-64">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-stone-700 hover:bg-white/60"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand shows on mobile only — the closed drawer hides the
              sidebar's brand, so keep it visible here. On desktop the
              brand lives at the top of the slate sidebar. */}
          <Link
            href="/dashboard"
            className="md:hidden text-lg font-semibold tracking-tight"
            style={{ color: "var(--district-primary)" }}
          >
            {branding.name}
          </Link>
        </div>

        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
