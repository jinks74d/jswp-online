/**
 * createScopedUser — the single direct-create path for provisioning a scoped
 * account (district_admin / school_admin / teacher / student). Generalizes the
 * super-admins pattern: create auth.users (service role, email pre-confirmed)
 * with a generated temp password, then insert the user_profiles row; on profile
 * failure, delete the orphan auth user.
 *
 * Does NOT authorize — callers MUST gate (requireRole) and validate scope
 * before calling. Returns the one-time temp password for the caller to surface.
 *
 * SERVER ONLY.
 */

import "server-only";

import * as crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

const PASSWORD_LENGTH = 12;
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no look-alikes

export function generateTempPassword(): string {
  const bytes = crypto.randomBytes(PASSWORD_LENGTH);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export type ScopedRole =
  | "district_admin"
  | "school_admin"
  | "teacher"
  | "student";

export type CreateScopedUserInput = {
  role: ScopedRole;
  districtId: string | null;
  schoolId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevel?: string | null;
  studentIdExternal?: string | null;
};

export type CreateScopedUserResult =
  | { ok: true; userId: string; password: string }
  | { ok: false; error: string; duplicateEmail?: boolean };

export async function createScopedUser(
  input: CreateScopedUserInput
): Promise<CreateScopedUserResult> {
  const admin = createAdminClient();
  const password = generateTempPassword();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });

  if (error || !created?.user) {
    const message = error?.message ?? "Could not create the account.";
    if (/already|exists|registered/i.test(message)) {
      return { ok: false, error: "An account with this email already exists.", duplicateEmail: true };
    }
    return { ok: false, error: message };
  }

  const userId = created.user.id;
  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: userId,
    role: input.role,
    district_id: input.districtId,
    school_id: input.schoolId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    grade_level: input.gradeLevel ?? null,
    student_id_external: input.studentIdExternal ?? null,
  });

  if (profileErr) {
    // Orphan guard — roll back the auth user.
    await admin.auth.admin.deleteUser(userId).catch(() => {
      /* surfaced via profileErr */
    });
    if (/duplicate|unique/i.test(profileErr.message)) {
      return { ok: false, error: "An account with this email already exists.", duplicateEmail: true };
    }
    return { ok: false, error: profileErr.message };
  }

  return { ok: true, userId, password };
}
