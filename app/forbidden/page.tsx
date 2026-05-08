/**
 * Landing page for users whose role doesn't grant access to the requested
 * route. Reached via requireRole() in lib/auth.ts.
 */

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="text-sm text-gray-600">
          Your account doesn&apos;t have permission to view this page. If you
          think this is wrong, contact your district administrator.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Go home
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
