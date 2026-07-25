/**
 * Student enrollment into a class period (super / district / school admin in
 * scope). Single add: find-or-create the student, then enroll. Scope is
 * validated by reading the period (+ its district via the school) through RLS;
 * student create/lookup uses the admin client (auth.users). audit_log via the
 * service role.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit-log";
import { createScopedUser } from "@/lib/scoped-users";

export type EnrollFormState = {
  error?: string;
  fieldErrors?: { first_name?: string; last_name?: string; email?: string };
  /** password present only when a new account was created. */
  success?: { email: string; password?: string };
};

export type UnenrollState = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGE_ROLES = ["super_admin", "district_admin", "school_admin"] as const;

export async function createAndEnrollStudent(
  _prev: EnrollFormState,
  formData: FormData
): Promise<EnrollFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);

  const periodId = String(formData.get("period_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const gradeLevel = String(formData.get("grade_level") ?? "").trim() || null;

  const fieldErrors: NonNullable<EnrollFormState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  if (!periodId) return { error: "Missing period id." };

  const supabase = await createServerClient();
  const { data: period } = await supabase
    .from("class_periods")
    .select("id, school_id, school:school_id(district_id)")
    .eq("id", periodId)
    .maybeSingle();
  const schoolId = (period as { school_id?: string } | null)?.school_id;
  const districtId = (
    period as { school?: { district_id?: string } } | null
  )?.school?.district_id;
  if (!period || !schoolId || !districtId) {
    return { error: "Class period not found or outside your scope." };
  }

  const admin = createAdminClient();

  // Find-or-create the student.
  const { data: existing } = await admin
    .from("user_profiles")
    .select("id, role, district_id")
    .eq("email", email)
    .maybeSingle();

  let studentId: string;
  let password: string | undefined;

  if (existing) {
    if (existing.role !== "student")
      return { fieldErrors: { email: `Email exists with role "${existing.role}".` } };
    if (existing.district_id !== districtId)
      return { fieldErrors: { email: "Email exists in a different district." } };
    await admin
      .from("user_profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
        school_id: schoolId,
      })
      .eq("id", existing.id);
    studentId = existing.id;
  } else {
    const res = await createScopedUser({
      role: "student",
      districtId,
      schoolId,
      firstName,
      lastName,
      email,
      gradeLevel,
    });
    if (!res.ok) {
      return res.duplicateEmail
        ? { fieldErrors: { email: res.error } }
        : { error: res.error };
    }
    studentId = res.userId;
    password = res.password;
  }

  const { error: enrollErr } = await admin
    .from("class_student_enrollments")
    .upsert(
      { class_period_id: periodId, student_id: studentId, unenrolled_at: null },
      { onConflict: "class_period_id,student_id" }
    );
  if (enrollErr) return { error: enrollErr.message };

  await writeAuditLog({
    actor_id: actor.id,
    action: "class_period.enroll_student",
    target_scope: { class_period_id: periodId, student_id: studentId },
    metadata: { email, created: password != null },
    district_id: districtId,
    school_id: schoolId,
  });

  revalidatePath(`/admin/districts`);
  return { success: { email, password } };
}

export async function unenrollStudent(
  _prev: UnenrollState,
  formData: FormData
): Promise<UnenrollState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const periodId = String(formData.get("period_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  if (!periodId || !studentId) return { error: "Missing period or student." };

  const supabase = await createServerClient();
  const { data: affected, error } = await supabase
    .from("class_student_enrollments")
    .update({ unenrolled_at: new Date().toISOString() })
    .eq("class_period_id", periodId)
    .eq("student_id", studentId)
    .select("id");

  if (error) return { error: error.message };

  // RLS filters rather than errors: zero rows means the row is
  // outside this admin's scope (or gone). Without this, the action
  // reports success and writes an audit_log entry for a change that
  // never happened.
  if (!affected || affected.length === 0) {
    return { error: "That enrollment is no longer in your scope." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "class_period.unenroll_student",
    target_scope: { class_period_id: periodId, student_id: studentId },
    metadata: {},
  });

  revalidatePath(`/admin/districts`);
  return { success: "Student removed." };
}
