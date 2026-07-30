import type { Metadata } from "next";
/**
 * /district/classes — district-wide Class Periods. Counts (classes / subjects /
 * periods), a searchable list of every period with its class/subject/school,
 * and an empty state. "Create Class" opens a modal that creates a subject →
 * class → period under a chosen school. RLS scopes all reads to the district.
 */

import { requireRole } from "@/lib/auth";
import {
  getDistrictClassStats,
  listDistrictClassPeriods,
} from "@/lib/queries/district-classes";
import { listSchoolsForDistrict } from "@/lib/queries/schools";
import { ClassesView } from "./classes-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "District Classes" };

export default async function DistrictClassesPage() {
  const profile = await requireRole("district_admin");
  if (!profile.district_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a district yet.
      </p>
    );
  }

  const [stats, periods, schoolRows] = await Promise.all([
    getDistrictClassStats(),
    listDistrictClassPeriods(),
    listSchoolsForDistrict(profile.district_id),
  ]);

  const schools = schoolRows.map((s) => ({ id: s.id, name: s.name }));

  return <ClassesView stats={stats} periods={periods} schools={schools} />;
}
