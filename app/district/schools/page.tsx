/**
 * /district/schools — district-admin Schools dashboard. A searchable grid of
 * school cards (with per-school user counts) plus a district summary, scoped to
 * the signed-in district admin's own district. Super admins manage schools via
 * the Districts drill-down instead, so this route is district_admin-only.
 */

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import {
  listSchoolsForDistrict,
  getSchoolUserCounts,
} from "@/lib/queries/schools";
import { SchoolsDashboard, type SchoolCard } from "./schools-dashboard";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });

export default async function DistrictSchoolsPage() {
  const profile = await requireRole("district_admin");
  // A district admin always has a district; guard the type and bad data.
  if (!profile.district_id) notFound();

  const [district, schools, counts] = await Promise.all([
    getDistrict(profile.district_id),
    listSchoolsForDistrict(profile.district_id),
    getSchoolUserCounts(profile.district_id),
  ]);

  const cards: SchoolCard[] = schools.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    active: s.active,
    userCount: counts[s.id] ?? 0,
    addedLabel: s.created_at ? dateFmt.format(new Date(s.created_at)) : "—",
  }));

  return (
    <SchoolsDashboard
      districtId={profile.district_id}
      districtName={district?.name ?? "your district"}
      schools={cards}
    />
  );
}
