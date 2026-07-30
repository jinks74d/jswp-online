/**
 * School-scoped class reads for /school/classes. RLS limits subjects/classes/
 * class_periods to the school admin's school; we filter by school_id too.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type SchoolClassStats = {
  classes: number;
  subjects: number;
  periods: number;
};

export async function getSchoolClassStats(
  schoolId: string
): Promise<SchoolClassStats> {
  const supabase = await createServerClient();
  const head = { count: "exact" as const, head: true };
  const [classes, subjects, periods] = await Promise.all([
    supabase.from("classes").select("id", head).eq("school_id", schoolId),
    supabase.from("subjects").select("id", head).eq("school_id", schoolId),
    supabase.from("class_periods").select("id", head).eq("school_id", schoolId),
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

export type SchoolPeriodRow = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  periodLabel: string;
  createdAt: string | null;
  enrolled: number;
};

type PeriodSelectRow = {
  id: string;
  class_id: string;
  period_label: string;
  created_at: string | null;
  class:
    | { name: string; subject_id: string; subject: { name: string } | { name: string }[] | null }
    | { name: string; subject_id: string; subject: { name: string } | { name: string }[] | null }[]
    | null;
  enrollments: { count: number }[];
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

/** Every class period at the school, with its class/subject + enrollment count. */
export async function listSchoolClassPeriods(
  schoolId: string
): Promise<SchoolPeriodRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_periods")
    .select(
      `id, class_id, period_label, created_at,
       class:class_id ( name, subject_id, subject:subject_id ( name ) ),
       enrollments:class_student_enrollments ( count )`
    )
    .eq("school_id", schoolId)
    .order("period_label", { ascending: true });

  if (error) throw new Error(`Failed to load class periods: ${error.message}`);

  return ((data ?? []) as unknown as PeriodSelectRow[]).map((row) => {
    const cls = one(row.class);
    const subject = cls ? one(cls.subject) : null;
    return {
      id: row.id,
      classId: row.class_id,
      subjectId: cls?.subject_id ?? "",
      subjectName: subject?.name ?? "—",
      className: cls?.name ?? "Untitled class",
      periodLabel: row.period_label,
      createdAt: row.created_at,
      enrolled: row.enrollments?.[0]?.count ?? 0,
    };
  });
}
