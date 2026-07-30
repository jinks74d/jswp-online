/**
 * Class-period management + teacher assignment (super / district / school admin
 * in scope). school_id is derived from the parent class; writes ride
 * class_periods_admin_manage / class_teacher_assignments_admin_manage. audit_log
 * via the service role.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";

export type ClassPeriodFormState = {
  error?: string;
  fieldErrors?: { period_label?: string };
  success?: string;
};

export type AssignmentState = { error?: string; success?: string };

const MANAGE_ROLES = ["super_admin", "district_admin", "school_admin"] as const;

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createClassPeriod(
  _prev: ClassPeriodFormState,
  formData: FormData
): Promise<ClassPeriodFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const classId = String(formData.get("class_id") ?? "");
  const periodLabel = String(formData.get("period_label") ?? "").trim();
  const academicYear =
    String(formData.get("academic_year") ?? "").trim() || null;
  if (!classId) return { error: "Missing class id." };
  if (!periodLabel)
    return { fieldErrors: { period_label: "Period label is required." } };

  const supabase = await createServerClient();
  const { data: klass } = await supabase
    .from("classes")
    .select("id, school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!klass) return { error: "Class not found or outside your scope." };

  const { data, error } = await supabase
    .from("class_periods")
    .insert({
      class_id: klass.id,
      school_id: klass.school_id,
      period_label: periodLabel,
      academic_year: academicYear,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return {
        fieldErrors: {
          period_label: "This period already exists for the year.",
        },
      };
    return { error: error?.message ?? "Could not create the period." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "class_period.create",
    target_scope: { class_period_id: data.id, class_id: klass.id },
    metadata: { period_label: periodLabel, academic_year: academicYear },
    school_id: klass.school_id,
  });

  revalidatePath(`/admin/districts`);
  return { success: `Created period “${periodLabel}”.` };
}

export async function updateClassPeriod(
  _prev: ClassPeriodFormState,
  formData: FormData
): Promise<ClassPeriodFormState> {
  await requireRole([...MANAGE_ROLES]);
  const periodId = String(formData.get("period_id") ?? "");
  const periodLabel = String(formData.get("period_label") ?? "").trim();
  const academicYear =
    String(formData.get("academic_year") ?? "").trim() || null;
  if (!periodId) return { error: "Missing period id." };
  if (!periodLabel)
    return { fieldErrors: { period_label: "Period label is required." } };

  const supabase = await createServerClient();
  const { data: affected, error } = await supabase
    .from("class_periods")
    .update({ period_label: periodLabel, academic_year: academicYear })
    .eq("id", periodId)
    .select("id");

  if (error) {
    if (isUniqueViolation(error.message))
      return {
        fieldErrors: {
          period_label: "This period already exists for the year.",
        },
      };
    return { error: error.message };
  }

  // RLS filters rather than errors: zero rows means the row is
  // outside this admin's scope (or gone). Without this, the action
  // reports success and writes an audit_log entry for a change that
  // never happened.
  if (!affected || affected.length === 0) {
    return { error: "That period is no longer in your scope." };
  }

  revalidatePath(`/admin/districts`);
  return { success: "Saved." };
}

export async function assignTeacher(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const periodId = String(formData.get("period_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  if (!periodId || !teacherId) return { error: "Missing period or teacher." };

  const supabase = await createServerClient();

  const { data: period } = await supabase
    .from("class_periods")
    .select("id, school_id")
    .eq("id", periodId)
    .maybeSingle();
  if (!period) return { error: "Period not found or outside your scope." };

  // Validate the teacher belongs to this school (don't trust the client).
  const { data: teacher } = await supabase
    .from("user_profiles")
    .select("id, role, school_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher || teacher.role !== "teacher" || teacher.school_id !== period.school_id) {
    return { error: "That teacher isn't at this school." };
  }

  // First teacher on the period becomes primary.
  const { count } = await supabase
    .from("class_teacher_assignments")
    .select("*", { count: "exact", head: true })
    .eq("class_period_id", periodId);

  const { error } = await supabase.from("class_teacher_assignments").insert({
    class_period_id: periodId,
    teacher_id: teacherId,
    is_primary: (count ?? 0) === 0,
    assigned_by: actor.id,
  });

  if (error) {
    if (isUniqueViolation(error.message))
      return { error: "That teacher is already assigned." };
    return { error: error.message };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "class_period.assign_teacher",
    target_scope: { class_period_id: periodId, teacher_id: teacherId },
    metadata: {},
    school_id: period.school_id,
  });

  revalidatePath(`/admin/districts`);
  return { success: "Teacher assigned." };
}

export async function unassignTeacher(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const periodId = String(formData.get("period_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  if (!periodId || !teacherId) return { error: "Missing period or teacher." };

  const supabase = await createServerClient();
  const { data: affected, error } = await supabase
    .from("class_teacher_assignments")
    .delete()
    .eq("class_period_id", periodId)
    .eq("teacher_id", teacherId)
    .select("id");

  if (error) return { error: error.message };

  // RLS filters rather than errors: zero rows means the row is
  // outside this admin's scope (or gone). Without this, the action
  // reports success and writes an audit_log entry for a change that
  // never happened.
  if (!affected || affected.length === 0) {
    return { error: "That teacher assignment is no longer in your scope." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "class_period.unassign_teacher",
    target_scope: { class_period_id: periodId, teacher_id: teacherId },
    metadata: {},
  });

  revalidatePath(`/admin/districts`);
  return { success: "Teacher removed." };
}
