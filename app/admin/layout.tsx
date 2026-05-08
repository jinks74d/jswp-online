/**
 * Admin section layout. Permanent home for super/district/school admin
 * functions — separate mental model from the teacher dashboard, separate
 * sidebar in future tickets. Auth gate enforces role at the layout level
 * so every page under app/admin/ inherits it.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xl font-semibold text-gray-900">
              Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-gray-600">
              <Link href="/admin/signups" className="hover:text-gray-900">
                Signup requests
              </Link>
              <Link
                href="/admin/import/students"
                className="hover:text-gray-900"
              >
                Import students
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              {profile.email}{" "}
              <span className="text-gray-400">· {profile.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
