/**
 * Read-only queries for the teacher student views. All queries use the
 * RLS-scoped server client — if the caller can't see a row, neither can
 * the query.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/* ─── Return types ───────────────────────────────────────────────────── */

export interface StudentEnrollmentSummary {
  class_period_id: string;
  period_label: string;
  className: string;
}

export interface TeacherStudent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  grade_level: string | null;
  enrollments: StudentEnrollmentSummary[];
}

export interface StudentEnrollmentDetail {
  class_period_id: string;
  period_label: string;
  academic_year: string | null;
  className: string;
  subjectName: string;
  schoolName: string;
}

export interface TeacherStudentDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  grade_level: string | null;
  student_id_external: string | null;
  enrollments: StudentEnrollmentDetail[];
}

/* ─── Internal raw-row shapes ────────────────────────────────────────── */

type EnrollmentForListRow = {
  class_period_id: string;
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    grade_level: string | null;
  } | null;
  class_period: {
    period_label: string;
    class: { name: string } | null;
  } | null;
};

type EnrollmentForDetailRow = {
  class_period: {
    id: string;
    period_label: string;
    academic_year: string | null;
    class: {
      name: string;
      subject: { name: string } | null;
    } | null;
    school: { name: string } | null;
  } | null;
};

/* ─── Queries ────────────────────────────────────────────────────────── */

/**
 * All students enrolled in any class period the teacher teaches.
 * Deduplicated — a student in two periods appears once with both
 * enrollments listed.
 */
export async function getStudentsForTeacher(
  teacherId: string
): Promise<TeacherStudent[]> {
  const supabase = await createServerClient();

  // 1. Find the teacher's class periods.
  const { data: assignments, error: aErr } = await supabase
    .from("class_teacher_assignments")
    .select("class_period_id")
    .eq("teacher_id", teacherId);

  if (aErr) {
    console.error("getStudentsForTeacher (assignments):", aErr);
    return [];
  }
  if (!assignments || assignments.length === 0) return [];

  const periodIds = assignments.map((a) => a.class_period_id);

  // 2. Fetch all current enrollments in those periods, joined to student
  //    profile and class period name.
  const { data, error: eErr } = await supabase
    .from("class_student_enrollments")
    .select(
      `
      class_period_id,
      student:student_id (
        id,
        first_name,
        last_name,
        email,
        grade_level
      ),
      class_period:class_period_id (
        period_label,
        class:class_id ( name )
      )
      `
    )
    .in("class_period_id", periodIds)
    .is("unenrolled_at", null);

  if (eErr) {
    console.error("getStudentsForTeacher (enrollments):", eErr);
    return [];
  }

  const rows = (data ?? []) as unknown as EnrollmentForListRow[];

  // 3. Dedup with a Map keyed by student_id (constant-time lookup).
  const byStudent = new Map<string, TeacherStudent>();

  for (const row of rows) {
    const student = row.student;
    if (!student) continue;

    const enrollment: StudentEnrollmentSummary = {
      class_period_id: row.class_period_id,
      period_label: row.class_period?.period_label ?? "—",
      className: row.class_period?.class?.name ?? "—",
    };

    const existing = byStudent.get(student.id);
    if (existing) {
      existing.enrollments.push(enrollment);
    } else {
      byStudent.set(student.id, {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        grade_level: student.grade_level,
        enrollments: [enrollment],
      });
    }
  }

  return Array.from(byStudent.values()).sort((a, b) =>
    (a.last_name ?? "").localeCompare(b.last_name ?? "")
  );
}

/**
 * Single-student detail, scoped to the teacher's class periods. Returns
 * null if the student isn't enrolled in any of the teacher's periods
 * (which includes "student doesn't exist" and "exists but in another
 * teacher's class").
 */
export async function getStudentDetail(
  studentId: string,
  teacherId: string
): Promise<TeacherStudentDetail | null> {
  const supabase = await createServerClient();

  // 1. Teacher's class period ids.
  const { data: assignments } = await supabase
    .from("class_teacher_assignments")
    .select("class_period_id")
    .eq("teacher_id", teacherId);

  if (!assignments || assignments.length === 0) return null;
  const periodIds = assignments.map((a) => a.class_period_id);

  // 2. Enrollments scoped to the teacher's periods.
  const { data: enrData, error: enrErr } = await supabase
    .from("class_student_enrollments")
    .select(
      `
      class_period:class_period_id (
        id,
        period_label,
        academic_year,
        class:class_id (
          name,
          subject:subject_id ( name )
        ),
        school:school_id ( name )
      )
      `
    )
    .eq("student_id", studentId)
    .in("class_period_id", periodIds)
    .is("unenrolled_at", null);

  if (enrErr) {
    console.error("getStudentDetail (enrollments):", enrErr);
    return null;
  }

  const enrollmentRows =
    (enrData ?? []) as unknown as EnrollmentForDetailRow[];

  if (enrollmentRows.length === 0) return null;

  // 3. Student profile.
  const { data: studentData, error: sErr } = await supabase
    .from("user_profiles")
    .select(
      "id, first_name, last_name, email, grade_level, student_id_external"
    )
    .eq("id", studentId)
    .maybeSingle();

  if (sErr || !studentData) {
    console.error("getStudentDetail (profile):", sErr);
    return null;
  }

  const enrollments: StudentEnrollmentDetail[] = enrollmentRows
    .map((r) => r.class_period)
    .filter((cp): cp is NonNullable<typeof cp> => cp !== null)
    .map((cp) => ({
      class_period_id: cp.id,
      period_label: cp.period_label,
      academic_year: cp.academic_year,
      className: cp.class?.name ?? "—",
      subjectName: cp.class?.subject?.name ?? "—",
      schoolName: cp.school?.name ?? "—",
    }));

  return {
    id: studentData.id,
    first_name: studentData.first_name,
    last_name: studentData.last_name,
    email: studentData.email,
    grade_level: studentData.grade_level,
    student_id_external: studentData.student_id_external,
    enrollments,
  };
}
