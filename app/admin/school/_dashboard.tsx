/**
 * Shared plumbing for the three school-admin dashboards. Each kind's page is a
 * thin wrapper: it calls requireSchoolAdminOfKind() to gate + guard, then
 * renders SchoolAdminDashboardShell. The "_" prefix keeps this out of routing.
 *
 * NOTE: these are scaffold shells. The placeholder cards are intentional TODOs
 * — the three kinds share the same permissions, so the content (which tools
 * each surfaces) is a follow-up once Raymond specifies it.
 */

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  ADMIN_KINDS,
  adminDashboardPath,
  adminKindLabel,
  resolveAdminKind,
  type AdminKind,
} from "@/lib/admin-kinds";
import type { UserProfiles } from "@/lib/database.types";

/**
 * Gate to school_admin, then ensure the signed-in admin's kind matches the
 * page they're on. A counselor who hand-types the administrator URL is bounced
 * to their own dashboard. Returns the profile on a match.
 */
export async function requireSchoolAdminOfKind(
  expected: AdminKind
): Promise<UserProfiles> {
  const profile = await requireRole("school_admin");
  const actual = resolveAdminKind(profile.admin_kind);
  if (actual !== expected) {
    redirect(adminDashboardPath(actual));
  }
  return profile;
}

const ACCENT: Record<AdminKind, string> = {
  administrator: "border-blue-500 bg-blue-50",
  counselor: "border-emerald-500 bg-emerald-50",
  other: "border-amber-500 bg-amber-50",
};

export function SchoolAdminDashboardShell({
  kind,
  profile,
}: {
  kind: AdminKind;
  profile: UserProfiles;
}) {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <header className={`rounded-lg border-l-4 p-5 ${ACCENT[kind]}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {adminKindLabel(kind)} dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          Welcome{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          This is the {adminKindLabel(kind).toLowerCase()} view. The tools below
          are placeholders — coming soon.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard title={`${adminKindLabel(kind)} tools`} />
        <PlaceholderCard title="Recent activity" />
      </div>
    </div>
  );
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">TODO — content coming soon.</p>
    </div>
  );
}

/** Re-exported so the bare /admin/school redirect can resolve the default. */
export { ADMIN_KINDS };
