/**
 * Read-only queries for the teacher class views. All queries use the
 * RLS-scoped server client — if the caller can't see a row, neither can
 * the query. Application code does not re-implement scope checks.
 *
 * Schema reference: migrations/0001_init_jswp_schema.sql
 *   class_periods            (id, class_id, school_id, period_label, academic_year)
 *   class_teacher_assignments (class_period_id, teacher_id)
 *   class_student_enrollments (class_period_id, student_id, unenrolled_at)
 *   user_profiles            (first_name, last_name, email, grade_level, student_id_external)
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/* ─── Return types ───────────────────────────────────────────────────── */

export interface TeacherClassPeriod {
  id: string;
  period_label: string;
  academic_year: string | null;
  className: string;
  subjectName: string;
  schoolName: string;
  studentCount: number;
}

export interface RosterStudent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  grade_level: string | null;
  student_id_external: string | null;
}

export interface ClassPeriodWithRoster {
  id: string;
  period_label: string;
  academic_year: string | null;
  className: string;
  subjectName: string;
  schoolName: string;
  roster: RosterStudent[];
}

/* ─── Internal raw-row shapes ────────────────────────────────────────── */

type AssignmentRow = {
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

type ClassPeriodRow = {
  id: string;
  period_label: string;
  academic_year: string | null;
  class: {
    name: string;
    subject: { name: string } | null;
  } | null;
  school: { name: string } | null;
};

type EnrollmentStudentRow = {
  student: RosterStudent | null;
};

/* ─── Queries ────────────────────────────────────────────────────────── */

/**
 * Every class period the teacher is assigned to, with a separate count
 * of currently-enrolled students (unenrolled_at IS NULL) per class.
 *
 * Per-class count is acceptable because teachers typically have ≤6
 * classes. If we ever need to scale this, it becomes a database view.
 */
export async function getTeacherClassPeriods(
  teacherId: string
): Promise<TeacherClassPeriod[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("class_teacher_assignments")
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
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("getTeacherClassPeriods:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as AssignmentRow[];

  // For each row, fire a count query for currently-enrolled students.
  const results: TeacherClassPeriod[] = [];
  for (const row of rows) {
    const cp = row.class_period;
    if (!cp) continue;

    const { count } = await supabase
      .from("class_student_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_period_id", cp.id)
      .is("unenrolled_at", null);

    results.push({
      id: cp.id,
      period_label: cp.period_label,
      academic_year: cp.academic_year,
      className: cp.class?.name ?? "—",
      subjectName: cp.class?.subject?.name ?? "—",
      schoolName: cp.school?.name ?? "—",
      studentCount: count ?? 0,
    });
  }

  // Sort by school, then class, then period for stable display order.
  results.sort(
    (a, b) =>
      a.schoolName.localeCompare(b.schoolName) ||
      a.className.localeCompare(b.className) ||
      a.period_label.localeCompare(b.period_label)
  );

  return results;
}

/**
 * One class period plus its roster. Returns null if the period doesn't
 * exist or is outside the caller's RLS scope.
 */
export async function getClassPeriodWithRoster(
  periodId: string
): Promise<ClassPeriodWithRoster | null> {
  const supabase = await createServerClient();

  const periodResult = await supabase
    .from("class_periods")
    .select(
      `
      id,
      period_label,
      academic_year,
      class:class_id (
        name,
        subject:subject_id ( name )
      ),
      school:school_id ( name )
      `
    )
    .eq("id", periodId)
    .maybeSingle();

  const period = periodResult.data as unknown as ClassPeriodRow | null;
  if (!period) return null;

  const enrollmentsResult = await supabase
    .from("class_student_enrollments")
    .select(
      `
      student:student_id (
        id,
        first_name,
        last_name,
        email,
        grade_level,
        student_id_external
      )
      `
    )
    .eq("class_period_id", periodId)
    .is("unenrolled_at", null);

  const enrollments =
    (enrollmentsResult.data ?? []) as unknown as EnrollmentStudentRow[];

  const roster: RosterStudent[] = enrollments
    .map((e) => e.student)
    .filter((s): s is RosterStudent => s !== null)
    .sort((a, b) =>
      (a.last_name ?? "").localeCompare(b.last_name ?? "")
    );

  return {
    id: period.id,
    period_label: period.period_label,
    academic_year: period.academic_year,
    className: period.class?.name ?? "—",
    subjectName: period.class?.subject?.name ?? "—",
    schoolName: period.school?.name ?? "—",
    roster,
  };
}
