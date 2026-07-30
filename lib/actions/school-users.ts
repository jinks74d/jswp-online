/**
 * Direct-create actions for school-scoped users (admins + teachers). Shared
 * body; super_admin or district_admin only. Scope is validated by reading the
 * target school via the RLS server client — an out-of-scope school reads back
 * null, so the action refuses before any account is created. Returns a
 * one-time temp password to surface.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import { createScopedUser, type ScopedUserFormState } from "@/lib/scoped-users";
import { resolveAdminKind } from "@/lib/admin-kinds";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createSchoolUser(
  role: "school_admin" | "teacher",
  formData: FormData
): Promise<ScopedUserFormState> {
  const actor = await requireRole(["super_admin", "district_admin"]);

  const schoolId = String(formData.get("school_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  // Only meaningful for admins; teachers ignore it. Unknown/blank → default.
  const adminKind =
    role === "school_admin"
      ? resolveAdminKind(String(formData.get("admin_kind") ?? ""))
      : null;

  const fieldErrors: NonNullable<ScopedUserFormState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  if (!schoolId) return { error: "Missing school id." };

  const supabase = await createServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, district_id")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return { error: "School not found or outside your scope." };

  const res = await createScopedUser({
    role,
    districtId: school.district_id,
    schoolId: school.id,
    firstName,
    lastName,
    email,
    adminKind,
  });

  if (!res.ok) {
    return res.duplicateEmail
      ? { fieldErrors: { email: res.error } }
      : { error: res.error };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: `${role}.create`,
    target_scope: { user_profile_id: res.userId, school_id: school.id },
    metadata: adminKind ? { email, admin_kind: adminKind } : { email },
    district_id: school.district_id,
    school_id: school.id,
  });

  revalidatePath(`/admin/districts/${school.district_id}/schools/${school.id}`);
  revalidatePath("/district/users");
  return { success: { email, password: res.password } };
}

/**
 * Create a school-scoped user (school_admin or teacher) from a form that
 * carries the role — used by the district Users "Create User" modal, where the
 * role is chosen in the UI rather than fixed by the page.
 */
export async function createSchoolUserFromForm(
  _prev: ScopedUserFormState,
  formData: FormData
): Promise<ScopedUserFormState> {
  const role = String(formData.get("role") ?? "");
  if (role !== "school_admin" && role !== "teacher") {
    return { error: "Choose a role (School Admin or Teacher)." };
  }
  return createSchoolUser(role, formData);
}

export async function createSchoolAdmin(
  _prev: ScopedUserFormState,
  formData: FormData
): Promise<ScopedUserFormState> {
  return createSchoolUser("school_admin", formData);
}

export async function createTeacher(
  _prev: ScopedUserFormState,
  formData: FormData
): Promise<ScopedUserFormState> {
  return createSchoolUser("teacher", formData);
}

/**
 * Create a teacher at the signed-in school admin's own school. Unlike
 * createTeacher (super/district admins, school chosen via form), this is gated
 * to school_admin and fixes the school to their own — matching the
 * user_profiles_school_admin_manage RLS policy. Surfaces the temp password.
 */
export async function createTeacherAtSchool(
  _prev: ScopedUserFormState,
  formData: FormData
): Promise<ScopedUserFormState> {
  const actor = await requireRole("school_admin");
  if (!actor.school_id || !actor.district_id) {
    return { error: "Your account isn’t linked to a school." };
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const teacherIdExternal =
    String(formData.get("teacher_id_external") ?? "").trim() || null;

  const fieldErrors: NonNullable<ScopedUserFormState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const res = await createScopedUser({
    role: "teacher",
    districtId: actor.district_id,
    schoolId: actor.school_id,
    firstName,
    lastName,
    email,
    teacherIdExternal,
  });

  if (!res.ok) {
    return res.duplicateEmail
      ? { fieldErrors: { email: res.error } }
      : { error: res.error };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "teacher.create",
    target_scope: { user_profile_id: res.userId, school_id: actor.school_id },
    metadata: { email },
    district_id: actor.district_id,
    school_id: actor.school_id,
  });

  revalidatePath("/school/teachers");
  return { success: { email, password: res.password } };
}

/**
 * Create a student at the signed-in school admin's own school — gated to
 * school_admin, school fixed to their own (matching user_profiles_school_admin_
 * manage RLS). Captures optional grade + external student ID. Surfaces the temp
 * password. The student is created unenrolled; enroll them from a period page.
 */
export async function createStudentAtSchool(
  _prev: ScopedUserFormState,
  formData: FormData
): Promise<ScopedUserFormState> {
  const actor = await requireRole("school_admin");
  if (!actor.school_id || !actor.district_id) {
    return { error: "Your account isn’t linked to a school." };
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const gradeLevel = String(formData.get("grade_level") ?? "").trim() || null;
  const studentIdExternal =
    String(formData.get("student_id_external") ?? "").trim() || null;

  const fieldErrors: NonNullable<ScopedUserFormState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const res = await createScopedUser({
    role: "student",
    districtId: actor.district_id,
    schoolId: actor.school_id,
    firstName,
    lastName,
    email,
    gradeLevel,
    studentIdExternal,
  });

  if (!res.ok) {
    return res.duplicateEmail
      ? { fieldErrors: { email: res.error } }
      : { error: res.error };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "student.create",
    target_scope: { user_profile_id: res.userId, school_id: actor.school_id },
    metadata: { email },
    district_id: actor.district_id,
    school_id: actor.school_id,
  });

  revalidatePath("/school/students");
  return { success: { email, password: res.password } };
}
