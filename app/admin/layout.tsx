/**
 * Admin section layout. Permanent home for super/district/school admin
 * functions — separate mental model from the teacher dashboard, separate
 * sidebar in future tickets. Auth gate enforces role at the layout level
 * so every page under app/admin/ inherits it.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole([
    "super_admin",
    "district_admin",
    "school_admin",
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-stretch gap-8">
            <Link
              href="/admin"
              className="flex items-center text-xl font-bold text-gray-900"
            >
              Admin
            </Link>
            <AdminNav role={profile.role} />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              {profile.email}{" "}
              <span className="text-gray-400">· {profile.role}</span>
            </span>
            <LogoutButton className="inline-flex items-center gap-1.5 font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50" />
          </div>
        </div>
      </header>
      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
