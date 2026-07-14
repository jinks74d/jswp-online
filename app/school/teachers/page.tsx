import type { Metadata } from "next";
/**
 * /school/teachers — teaching staff at the admin's school. Stat cards, search,
 * a table of teachers, and a staff overview. "Add Teacher" creates a teacher at
 * the school. RLS scopes reads to the school.
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { listSchoolUsersByRole } from "@/lib/queries/school-users";
import { TeachersView, type TeacherRow } from "./teachers-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Teachers" };

export default async function SchoolTeachersPage() {
  const profile = await requireRole("school_admin");
  if (!profile.school_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a school yet.
      </p>
    );
  }

  const [school, teacherRows] = await Promise.all([
    getSchool(profile.school_id),
    listSchoolUsersByRole(profile.school_id, "teacher"),
  ]);

  const teachers: TeacherRow[] = teacherRows.map((t) => ({
    id: t.id,
    firstName: t.first_name,
    lastName: t.last_name,
    email: t.email,
    active: t.active,
    createdAt: t.created_at,
  }));

  return (
    <TeachersView schoolName={school?.name ?? "Your school"} teachers={teachers} />
  );
}
