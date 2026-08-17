/**
 * District-admin area layout. A persistent left-sidebar shell (separate mental
 * model from the super/school-admin top-nav under app/admin/). The auth gate
 * enforces district_admin at the layout level, so every /district page inherits
 * it. Super and school admins keep the top-nav admin chrome.
 */

import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import { brandStyle, ADMIN_SHELL_DEFAULT_BRAND } from "@/lib/brand-style";
import { DistrictSidebar } from "./district-sidebar";

export default async function DistrictLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("district_admin");
  const district = profile.district_id
    ? await getDistrict(profile.district_id)
    : null;

  const userName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "District Admin";

  return (
    // Without this the /district tree had no --brand in scope of its own: it
    // fell back to whatever :root resolved from the subdomain, so a district
    // admin reaching the app on the apex domain saw the generic navy rather
    // than their own colour. Schools have always resolved theirs here.
    <div
      className="flex min-h-screen bg-gray-50"
      style={brandStyle(
        null,
        district?.primary_color,
        ADMIN_SHELL_DEFAULT_BRAND
      )}
    >
      <DistrictSidebar
        districtName={district?.name ?? "Your district"}
        userName={userName}
      />
      <main
        id="main-content"
        className="min-w-0 flex-1 px-8 py-7 lg:px-10"
      >
        {children}
      </main>
    </div>
  );
}
