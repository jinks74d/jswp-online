/**
 * v2 teacher shell. Server-side requireRole gates access to teacher,
 * school_admin, district_admin, and super_admin (students are routed
 * elsewhere by getRedirectPath). Fetches the user profile and district
 * branding once, passes them down as props — no client-side useAuth.
 *
 * Phase 7 backlog: replace legacy /dashboard/** route stubs (assignments/[id],
 * classes/[id], schools/, users/, etc.) before production cutover.
 */

import { requireRole } from "@/lib/auth";
import { getDistrictBrandingFromHeaders } from "@/lib/branding-headers";
import { getSchoolPrimaryColor } from "@/lib/queries/schools";
import { brandStyle } from "@/lib/brand-style";
import { TeacherShell } from "@/components/dashboard/shell/teacher-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);

  const branding = await getDistrictBrandingFromHeaders();

  // School accent beats district accent for anyone attached to a school.
  const schoolPrimary = profile.school_id
    ? await getSchoolPrimaryColor(profile.school_id)
    : null;

  return (
    <TeacherShell
      brandStyle={brandStyle(schoolPrimary, branding.primary_color)}
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        role: profile.role,
      }}
      branding={{
        name: branding.name,
        primaryColor: branding.primary_color,
      }}
    >
      {children}
    </TeacherShell>
  );
}
