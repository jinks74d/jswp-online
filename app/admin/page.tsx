import type { Metadata } from "next";
/**
 * Admin landing. Minimal — links to the available tools. Replaced with a
 * proper dashboard (analytics, recent activity) in Phase 6.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin Tools" };

export default async function AdminHome() {
  // District and school admins live in their own sidebar shells; super admins
  // stay here.
  const profile = await requireUser();
  if (profile.role === "district_admin") {
    redirect("/district");
  }
  if (profile.role === "school_admin") {
    redirect("/school");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Admin tools</h1>
        <p className="text-gray-600">
          Roster management and district administration.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/import/students"
          className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-sm transition"
        >
          <div className="flex items-start gap-3">
            <Upload className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">Import students</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload a CSV or Excel roster and enroll students in a class
                period.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
