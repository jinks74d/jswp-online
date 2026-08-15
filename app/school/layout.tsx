/**
 * School-admin area layout. A persistent left-sidebar shell, scoped to the
 * admin's own school. The auth gate enforces school_admin at the layout level,
 * so every /school page inherits it.
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getDistrict } from "@/lib/queries/districts";
import { brandStyle, SCHOOL_DEFAULT_BRAND } from "@/lib/brand-style";
import { SchoolSidebar } from "./school-sidebar";

// The shared resolver now lives in lib/brand-style.ts, applied here and by the
// teacher and student shells. SCHOOL_DEFAULT_BRAND keeps the rose look this
// area has always had when neither the school nor its district sets a colour.

export default async function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("school_admin");
  const school = profile.school_id ? await getSchool(profile.school_id) : null;
  const district = school?.district_id
    ? await getDistrict(school.district_id)
    : null;

  const userName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "School Admin";

  return (
    <div
      className="flex min-h-screen bg-gray-50"
      style={brandStyle(
        school?.primary_color,
        district?.primary_color,
        SCHOOL_DEFAULT_BRAND
      )}
    >
      <SchoolSidebar
        districtName={district?.name ?? "Your district"}
        schoolName={school?.name ?? "Your school"}
        userName={userName}
      />
      <main id="main-content" className="min-w-0 flex-1 px-8 py-7 lg:px-10">
        {children}
      </main>
    </div>
  );
}
