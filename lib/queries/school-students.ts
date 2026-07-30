/**
 * School-scoped student reads for /school/students. RLS limits user_profiles
 * and enrollments to the school admin's school; we filter by school_id too.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type SchoolStudentRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gradeLevel: string | null;
  studentIdExternal: string | null;
  active: boolean;
  createdAt: string | null;
};

export async function listSchoolStudents(
  schoolId: string
): Promise<SchoolStudentRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, first_name, last_name, email, grade_level, student_id_external, active, created_at"
    )
    .eq("school_id", schoolId)
    .eq("role", "student")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load students: ${error.message}`);

  return ((data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    grade_level: string | null;
    student_id_external: string | null;
    active: boolean;
    created_at: string | null;
  }[]).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email,
    gradeLevel: s.grade_level,
    studentIdExternal: s.student_id_external,
    active: s.active,
    createdAt: s.created_at,
  }));
}

/** Student ids enrolled in at least one class period at the school. */
export async function getEnrolledStudentIds(
  schoolId: string
): Promise<Set<string>> {
  const supabase = await createServerClient();

  const { data: periods, error: pErr } = await supabase
    .from("class_periods")
    .select("id")
    .eq("school_id", schoolId);
  if (pErr) throw new Error(`Failed to load periods: ${pErr.message}`);

  const periodIds = (periods ?? []).map((p) => (p as { id: string }).id);
  if (periodIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("class_student_enrollments")
    .select("student_id")
    .in("class_period_id", periodIds);
  if (error) throw new Error(`Failed to load enrollments: ${error.message}`);

  return new Set(
    (data ?? []).map((r) => (r as { student_id: string }).student_id)
  );
}
