import type { Metadata } from "next";
/**
 * /school/classes — class periods at the admin's school, grouped by subject,
 * with counts, search + subject filter, and a Create Class modal. RLS scopes
 * all reads to the school.
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { listSubjectsForSchool } from "@/lib/queries/subjects";
import {
  getSchoolClassStats,
  listSchoolClassPeriods,
} from "@/lib/queries/school-classes";
import { ClassesView } from "./classes-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "School Classes" };

export default async function SchoolClassesPage() {
  const profile = await requireRole("school_admin");
  if (!profile.school_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a school yet.
      </p>
    );
  }

  const [school, stats, periods, subjectRows] = await Promise.all([
    getSchool(profile.school_id),
    getSchoolClassStats(profile.school_id),
    listSchoolClassPeriods(profile.school_id),
    listSubjectsForSchool(profile.school_id),
  ]);

  return (
    <ClassesView
      schoolId={profile.school_id}
      districtId={school?.district_id ?? ""}
      stats={stats}
      periods={periods}
      subjects={subjectRows.map((s) => s.name)}
    />
  );
}
