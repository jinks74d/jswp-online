/**
 * Server action for creating a super admin from the admin UI.
 *
 * Super admins are the developers/owners of JSWP Online — districtless
 * platform operators. Self-signup can never grant super_admin (enforced by a
 * DB CHECK on signup_requests), so this is the only in-app path to create one,
 * and it is gated to existing super admins only.
 *
 * Flow: create the auth.users row (service role, email pre-confirmed), then
 * insert the districtless user_profiles row. If the profile insert fails the
 * just-created auth user is deleted so no orphan is left behind.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateSuperAdminState = {
  error?: string;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
  };
  success?: { email: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

export async function createSuperAdmin(
  _prev: CreateSuperAdminState,
  formData: FormData
): Promise<CreateSuperAdminState> {
  const actingAdmin = await requireRole("super_admin");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: NonNullable<CreateSuperAdminState["fieldErrors"]> = {};
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH)
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const admin = createAdminClient();

  // 1. Create the auth user (email pre-confirmed — no email round trip).
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    }
  );

  if (createErr || !created?.user) {
    const message = createErr?.message ?? "Could not create the account.";
    // Surface duplicate-email collisions on the email field.
    if (/already|exists|registered/i.test(message)) {
      return { fieldErrors: { email: "An account with this email already exists." } };
    }
    return { error: message };
  }

  const newUserId = created.user.id;

  // 2. Insert the districtless super_admin profile.
  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: newUserId,
    role: "super_admin",
    district_id: null,
    school_id: null,
    first_name: firstName,
    last_name: lastName,
    email,
  });

  if (profileErr) {
    // 3. Orphan guard — roll back the auth user.
    await admin.auth.admin.deleteUser(newUserId);
    if (/duplicate|unique/i.test(profileErr.message)) {
      return {
        fieldErrors: { email: "An account with this email already exists." },
      };
    }
    return { error: profileErr.message };
  }

  // 4. Audit the privileged action.
  await admin.from("audit_log").insert({
    actor_id: actingAdmin.id,
    action: "super_admin.create",
    target_scope: { user_profile_id: newUserId },
    metadata: { new_user_id: newUserId, email },
    district_id: null,
    school_id: null,
  });

  revalidatePath("/admin/super-admins");
  return { success: { email } };
}
