/**
 * School-admin area layout. A persistent left-sidebar shell, scoped to the
 * admin's own school. The auth gate enforces school_admin at the layout level,
 * so every /school page inherits it.
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getDistrict } from "@/lib/queries/districts";
import { isValidHexColor } from "@/lib/district-branding.types";
import { hexToRgb, getContrastColor } from "@/lib/district-branding.utils";
import { SchoolSidebar } from "./school-sidebar";

// Default accent when neither the school nor its district sets a colour —
// keeps the previous rose look for unbranded schools.
const DEFAULT_BRAND = "#e11d48"; // rose-600

/**
 * Resolve the accent the /school area should use — school colour first, then
 * the district's, then the rose default — and expose it as brand CSS vars the
 * components reference (so the whole shell follows the school's branding).
 */
function brandStyle(
  schoolPrimary: string | null | undefined,
  districtPrimary: string | null | undefined
): React.CSSProperties {
  const valid = (c: string | null | undefined) =>
    c && isValidHexColor(c) ? c : null;
  const brand = valid(schoolPrimary) ?? valid(districtPrimary) ?? DEFAULT_BRAND;
  const rgb = hexToRgb(brand) ?? { r: 225, g: 29, b: 72 };
  const tuple = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  return {
    "--brand": brand,
    "--brand-contrast": getContrastColor(brand),
    "--brand-rgb": tuple,
    "--brand-soft": `rgba(${tuple}, 0.1)`,
    "--brand-soft-strong": `rgba(${tuple}, 0.18)`,
  } as React.CSSProperties;
}

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
      style={brandStyle(school?.primary_color, district?.primary_color)}
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
