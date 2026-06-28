/**
 * /school/students — students at the admin's school. Same style as Teachers:
 * stat cards, search, a table (with grade + enrollment), and a roster overview.
 * "Add Student" creates a student at the school. RLS scopes reads to the school.
 */

import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import {
  listSchoolStudents,
  getEnrolledStudentIds,
} from "@/lib/queries/school-students";
import { StudentsView, type StudentRow } from "./students-view";

export const dynamic = "force-dynamic";

export default async function SchoolStudentsPage() {
  const profile = await requireRole("school_admin");
  if (!profile.school_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a school yet.
      </p>
    );
  }

  const [school, students, enrolled] = await Promise.all([
    getSchool(profile.school_id),
    listSchoolStudents(profile.school_id),
    getEnrolledStudentIds(profile.school_id),
  ]);

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    gradeLevel: s.gradeLevel,
    studentIdExternal: s.studentIdExternal,
    active: s.active,
    createdAt: s.createdAt,
  }));

  return (
    <StudentsView
      schoolName={school?.name ?? "Your school"}
      students={rows}
      enrolledIds={[...enrolled]}
    />
  );
}
