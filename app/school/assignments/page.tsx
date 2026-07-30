import type { Metadata } from "next";
/**
 * /school/assignments — read-only monitoring of assignments across the school,
 * grouped by teacher, with status + submission counts. School admins can view
 * but not author (assignments are teacher-owned; RLS is read-only here).
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getSchoolAssignments } from "@/lib/queries/school-assignments";
import { AssignmentsView } from "./assignments-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "School Assignments" };

export default async function SchoolAssignmentsPage() {
  const profile = await requireRole("school_admin");
  if (!profile.school_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a school yet.
      </p>
    );
  }

  const [school, { rows, stats, subjects }] = await Promise.all([
    getSchool(profile.school_id),
    getSchoolAssignments(profile.school_id),
  ]);

  return (
    <AssignmentsView
      schoolName={school?.name ?? "Your school"}
      rows={rows}
      stats={stats}
      subjects={subjects}
    />
  );
}
