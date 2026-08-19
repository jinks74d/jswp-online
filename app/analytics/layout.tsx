/**
 * Cross-district analytics shell (0061).
 *
 * A sibling of /admin, /district, /school and /dashboard rather than a child
 * of any of them, for the reason CLAUDE.md §5 gives for keeping those four
 * apart: this is a different mental model. The viewer here is read-only and
 * spans several districts, so /district — whose layout gates on
 * district_admin and resolves exactly one district's branding — is the wrong
 * parent on both counts.
 *
 * Fixed platform chrome, no --brand. Same argument as /admin in CLAUDE.md
 * §14.10: a console that lists four tenants side by side has no single
 * tenant's colour to resolve, and picking one would misrepresent the other
 * three.
 */

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // super_admin is admitted because auth_user_can_view_district() already
  // returns TRUE for them everywhere — excluding them here would mean the one
  // role that can see every district cannot open the page that shows them.
  const profile = await requireRole(["district_analyst", "super_admin"]);

  const userName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Analytics";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/analytics"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-gray-900">
              Program Analytics
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userName}</span>
            <Link
              href="/logout"
              className="rounded-md px-2 py-1 text-sm font-semibold text-gray-700 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
