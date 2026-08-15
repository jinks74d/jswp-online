/**
 * v2 student portal shell. Server-side requireRole gates access to
 * students only — teachers/admins navigating here land on /forbidden.
 * Branding is read from middleware-set headers (same pattern as the
 * teacher dashboard).
 */

import { requireRole } from "@/lib/auth";
import { getDistrictBrandingFromHeaders } from "@/lib/branding-headers";
import { getSchoolPrimaryColor } from "@/lib/queries/schools";
import { brandStyle } from "@/lib/brand-style";
import { StudentShell } from "@/components/student/shell/student-shell";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("student");
  const branding = await getDistrictBrandingFromHeaders();

  // School accent beats district accent for anyone attached to a school.
  const schoolPrimary = profile.school_id
    ? await getSchoolPrimaryColor(profile.school_id)
    : null;

  return (
    <StudentShell
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
    </StudentShell>
  );
}
