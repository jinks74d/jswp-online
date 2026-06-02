/**
 * Create a school admin (direct-create + one-time temp password). super_admin
 * or district_admin only. Scope is validated by reading the target school via
 * the RLS server client — a school outside the actor's scope reads back null,
 * so the action refuses before any account is created.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedUser } from "@/lib/scoped-users";

export type SchoolAdminFormState = {
  error?: string;
  fieldErrors?: { first_name?: string; last_name?: string; email?: string };
  success?: { email: string; password: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createSchoolAdmin(
  _prev: SchoolAdminFormState,
  formData: FormData
): Promise<SchoolAdminFormState> {
  const actor = await requireRole(["super_admin", "district_admin"]);

  const schoolId = String(formData.get("school_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const fieldErrors: NonNullable<SchoolAdminFormState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!schoolId) return { error: "Missing school id." };

  // Scope gate: RLS lets the actor read this school only if it's in their
  // district (or they're a super admin).
  const supabase = await createServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, district_id")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return { error: "School not found or outside your scope." };

  const res = await createScopedUser({
    role: "school_admin",
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
      action: "school_admin.create",
      target_scope: { user_profile_id: res.userId, school_id: school.id },
      metadata: { email },
      district_id: school.district_id,
      school_id: school.id,
    });

  revalidatePath(`/admin/districts/${school.district_id}/schools/${school.id}`);
  return { success: { email, password: res.password } };
}
