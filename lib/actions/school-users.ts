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
import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedUser, type ScopedUserFormState } from "@/lib/scoped-users";

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
  });

  if (!res.ok) {
    return res.duplicateEmail
      ? { fieldErrors: { email: res.error } }
      : { error: res.error };
  }

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: `${role}.create`,
      target_scope: { user_profile_id: res.userId, school_id: school.id },
      metadata: { email },
      district_id: school.district_id,
      school_id: school.id,
    });

  revalidatePath(`/admin/districts/${school.district_id}/schools/${school.id}`);
  return { success: { email, password: res.password } };
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
