/**
 * Admin-side class-period reads (level 3 of Subject -> Class -> Period) plus
 * teacher-assignment reads. RLS scopes everything to the caller's school/
 * district. Distinct from lib/queries/classes.ts (teacher-facing).
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { ClassPeriods } from "@/lib/database.types";

export type ClassPeriodListRow = Pick<
  ClassPeriods,
  "id" | "period_label" | "academic_year" | "created_at"
>;

export async function listPeriodsForClass(
  classId: string
): Promise<ClassPeriodListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_periods")
    .select("id, period_label, academic_year, created_at")
    .eq("class_id", classId)
    .order("academic_year", { ascending: false })
    .order("period_label", { ascending: true });

  if (error) throw new Error(`Failed to load periods: ${error.message}`);
  return (data ?? []) as ClassPeriodListRow[];
}

export async function getClassPeriod(id: string): Promise<ClassPeriods | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_periods")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load period: ${error.message}`);
  return (data as ClassPeriods | null) ?? null;
}

export type AssignedTeacher = {
  teacher_id: string;
  is_primary: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export async function listAssignedTeachers(
  periodId: string
): Promise<AssignedTeacher[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(
      "teacher_id, is_primary, teacher:teacher_id(first_name, last_name, email)"
    )
    .eq("class_period_id", periodId);

  if (error) throw new Error(`Failed to load assigned teachers: ${error.message}`);

  type Row = {
    teacher_id: string;
    is_primary: boolean;
    teacher: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    teacher_id: r.teacher_id,
    is_primary: r.is_primary,
    first_name: r.teacher?.first_name ?? null,
    last_name: r.teacher?.last_name ?? null,
    email: r.teacher?.email ?? null,
  }));
}
