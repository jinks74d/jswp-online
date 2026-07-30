/**
 * Enrolled-students read for a class period (admin side). RLS
 * (class_student_enrollments_admin_manage FOR ALL) grants admins SELECT.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type EnrolledStudent = {
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  grade_level: string | null;
  enrolled_at: string;
};

export async function listEnrolledStudents(
  periodId: string
): Promise<EnrolledStudent[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_student_enrollments")
    .select(
      "student_id, enrolled_at, student:student_id(first_name, last_name, email, grade_level)"
    )
    .eq("class_period_id", periodId)
    .is("unenrolled_at", null)
    .order("enrolled_at", { ascending: true });

  if (error) throw new Error(`Failed to load enrolled students: ${error.message}`);

  type Row = {
    student_id: string;
    enrolled_at: string;
    student: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      grade_level: string | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    student_id: r.student_id,
    enrolled_at: r.enrolled_at,
    first_name: r.student?.first_name ?? null,
    last_name: r.student?.last_name ?? null,
    email: r.student?.email ?? null,
    grade_level: r.student?.grade_level ?? null,
  }));
}
