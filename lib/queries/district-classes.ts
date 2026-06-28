/**
 * District-wide class reads for the /district/classes page. RLS already scopes
 * subjects / classes / class_periods to the district admin's own district (the
 * *_admin_manage policies use auth_user_is_admin_for_school across every school
 * in the district), so these queries don't re-filter by district.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type DistrictClassStats = {
  classes: number;
  subjects: number;
  periods: number;
};

export async function getDistrictClassStats(): Promise<DistrictClassStats> {
  const supabase = await createServerClient();
  const [classes, subjects, periods] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase.from("class_periods").select("id", { count: "exact", head: true }),
  ]);

  if (classes.error)
    throw new Error(`Failed to count classes: ${classes.error.message}`);
  if (subjects.error)
    throw new Error(`Failed to count subjects: ${subjects.error.message}`);
  if (periods.error)
    throw new Error(`Failed to count periods: ${periods.error.message}`);

  return {
    classes: classes.count ?? 0,
    subjects: subjects.count ?? 0,
    periods: periods.count ?? 0,
  };
}

export type DistrictPeriodRow = {
  id: string;
  schoolId: string;
  subjectId: string;
  classId: string;
  className: string;
  subjectName: string;
  schoolName: string;
  periodLabel: string;
  academicYear: string | null;
  enrolled: number;
};

type PeriodSelectRow = {
  id: string;
  class_id: string;
  school_id: string;
  period_label: string;
  academic_year: string | null;
  class:
    | { name: string; subject_id: string; subject: { name: string } | { name: string }[] | null }
    | { name: string; subject_id: string; subject: { name: string } | { name: string }[] | null }[]
    | null;
  school: { name: string } | { name: string }[] | null;
  enrollments: { count: number }[];
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

/** Every class period in the district, with its class/subject/school context. */
export async function listDistrictClassPeriods(): Promise<DistrictPeriodRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_periods")
    .select(
      `id, class_id, school_id, period_label, academic_year,
       class:class_id ( name, subject_id, subject:subject_id ( name ) ),
       school:school_id ( name ),
       enrollments:class_student_enrollments ( count )`
    )
    .order("academic_year", { ascending: false })
    .order("period_label", { ascending: true });

  if (error) throw new Error(`Failed to load class periods: ${error.message}`);

  return ((data ?? []) as unknown as PeriodSelectRow[]).map((row) => {
    const cls = one(row.class);
    const subject = cls ? one(cls.subject) : null;
    const school = one(row.school);
    return {
      id: row.id,
      schoolId: row.school_id,
      subjectId: cls?.subject_id ?? "",
      classId: row.class_id,
      className: cls?.name ?? "Untitled class",
      subjectName: subject?.name ?? "—",
      schoolName: school?.name ?? "—",
      periodLabel: row.period_label,
      academicYear: row.academic_year,
      enrolled: row.enrollments?.[0]?.count ?? 0,
    };
  });
}
