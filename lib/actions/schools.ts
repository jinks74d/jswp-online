/**
 * School management server actions. super_admin (any district) or
 * district_admin (own district) — RLS (schools_admin_manage) enforces the
 * district scope on write; requireRole is defense-in-depth. audit_log via the
 * service role (its only writer).
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit-log";
import { normalizeSchoolLevel } from "@/lib/school-levels";
import { createScopedUser } from "@/lib/scoped-users";
import { DEFAULT_ADMIN_KIND } from "@/lib/admin-kinds";
import {
  parseSchoolAdmins,
  validateSchoolAdmins,
  type SchoolAdminRowErrors,
} from "@/lib/school-admins";

export type SchoolFormState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    level?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
  };
  /** Per-administrator-row errors, index-aligned with the rendered rows. */
  adminErrors?: SchoolAdminRowErrors[];
  /** Whole-section error for the administrators block. */
  adminFormError?: string;
  success?: string;
  /**
   * One-time temp credentials for the admins provisioned alongside the school.
   * Shown once and never retrievable again — the form must surface them.
   */
  createdAdmins?: { email: string; password: string }[];
};

const MANAGE_ROLES = ["super_admin", "district_admin"] as const;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const URL_RE = /^https?:\/\//;

function emptyToNull(s: string): string | null {
  const v = s.trim();
  return v === "" ? null : v;
}

function parseSchoolForm(formData: FormData) {
  const levelRaw = String(formData.get("level") ?? "").trim();
  return {
    districtId: String(formData.get("district_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    address: emptyToNull(String(formData.get("address") ?? "")),
    levelRaw,
    // Canonical slugs pass through unchanged; custom "Other…" text is slugified
    // and capped to the 20-char column. See lib/school-levels.ts.
    level: normalizeSchoolLevel(levelRaw),
    primaryColor: emptyToNull(String(formData.get("primary_color") ?? "")),
    secondaryColor: emptyToNull(String(formData.get("secondary_color") ?? "")),
    logoUrl: emptyToNull(String(formData.get("logo_url") ?? "")),
    active:
      formData.get("active") === "on" || formData.get("active") === "true",
  };
}

function validate(f: ReturnType<typeof parseSchoolForm>): SchoolFormState["fieldErrors"] | null {
  const fe: NonNullable<SchoolFormState["fieldErrors"]> = {};
  if (!f.name) fe.name = "School name is required.";
  // The only way to fail level now: typed something that normalizes to nothing.
  if (f.levelRaw && !f.level)
    fe.level = "Enter a valid level name (letters and numbers).";
  if (f.primaryColor && !HEX_RE.test(f.primaryColor))
    fe.primary_color = "Use a hex color like #1E40AF.";
  if (f.secondaryColor && !HEX_RE.test(f.secondaryColor))
    fe.secondary_color = "Use a hex color like #1E40AF.";
  if (f.logoUrl && !URL_RE.test(f.logoUrl))
    fe.logo_url = "Must start with http:// or https://.";
  return Object.keys(fe).length ? fe : null;
}

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

/**
 * Create a school together with its school administrators.
 *
 * A school is never created without at least one school_admin — otherwise the
 * district admin has to remember a second, separate step, and a school with no
 * admin is invisible to everyone who would run it.
 *
 * Provisioning is all-or-nothing, mirroring createDistrict: insert the school,
 * create each admin, and on any failure delete the accounts created so far plus
 * the school itself. A half-provisioned school (exists, but the admin whose
 * email collided never got an account) is worse than a clean failure the user
 * can correct and resubmit.
 */
export async function createSchool(
  _prev: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const f = parseSchoolForm(formData);
  if (!f.districtId) return { error: "Missing district id." };

  const fe = validate(f);
  const adminRows = parseSchoolAdmins(formData);
  const adminCheck = validateSchoolAdmins(adminRows);

  // Validate the school and its admins together so one submission surfaces
  // every problem at once.
  if (fe || !adminCheck.ok) {
    return {
      ...(fe ? { fieldErrors: fe } : {}),
      ...(adminCheck.ok
        ? {}
        : {
            adminErrors: adminCheck.rowErrors,
            ...(adminCheck.formError
              ? { adminFormError: adminCheck.formError }
              : {}),
          }),
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      district_id: f.districtId,
      name: f.name,
      level: f.level,
      address: f.address,
      primary_color: f.primaryColor,
      secondary_color: f.secondaryColor,
      logo_url: f.logoUrl,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return { fieldErrors: { name: "A school with this name already exists." } };
    return { error: error?.message ?? "Could not create the school." };
  }

  const schoolId = data.id;
  const admin = createAdminClient();
  const createdIds: string[] = [];
  const createdAdmins: { email: string; password: string }[] = [];

  async function rollback(): Promise<void> {
    for (const uid of createdIds) {
      // Deleting auth.users cascades to user_profiles (FK ON DELETE CASCADE).
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    await supabase.from("schools").delete().eq("id", schoolId);
  }

  for (let i = 0; i < adminCheck.valid.length; i++) {
    const row = adminCheck.valid[i];
    const res = await createScopedUser({
      role: "school_admin",
      districtId: f.districtId,
      schoolId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      // Kind selects which dashboard the admin lands on; it is not collected on
      // this form. Changeable afterwards from the school's Manage Users view.
      adminKind: DEFAULT_ADMIN_KIND,
    });

    if (!res.ok) {
      await rollback();
      if (res.duplicateEmail) {
        // Map back to the submitted row so the error lands on the right input.
        const rowErrors = adminCheck.rowErrors.map((e) => ({ ...e }));
        const idx = adminRows.findIndex((r) => r.email === row.email);
        if (idx >= 0) {
          rowErrors[idx] = {
            ...rowErrors[idx],
            email: "An account with this email already exists.",
          };
        }
        return { adminErrors: rowErrors };
      }
      return { error: res.error };
    }

    createdIds.push(res.userId);
    createdAdmins.push({ email: row.email, password: res.password });
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "school.create",
    target_scope: { school_id: schoolId },
    metadata: {
      name: f.name,
      level: f.level,
      admin_count: createdAdmins.length,
      admin_emails: createdAdmins.map((a) => a.email),
    },
    district_id: f.districtId,
    school_id: schoolId,
  });

  // One entry per admin as well, matching the granularity of the standalone
  // createSchoolAdmin action so the user-creation trail is uniform.
  for (let i = 0; i < createdIds.length; i++) {
    await writeAuditLog({
      actor_id: actor.id,
      action: "school_admin.create",
      target_scope: { user_profile_id: createdIds[i], school_id: schoolId },
      metadata: {
        email: createdAdmins[i].email,
        admin_kind: DEFAULT_ADMIN_KIND,
        via: "school.create",
      },
      district_id: f.districtId,
      school_id: schoolId,
    });
  }

  revalidatePath(`/admin/districts/${f.districtId}`);
  revalidatePath("/district/schools");
  revalidatePath("/district/users");

  const n = createdAdmins.length;
  return {
    success: `Created “${f.name}” with ${n} ${n === 1 ? "administrator" : "administrators"}.`,
    createdAdmins,
  };
}

export async function updateSchool(
  _prev: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const schoolId = String(formData.get("school_id") ?? "");
  if (!schoolId) return { error: "Missing school id." };

  const f = parseSchoolForm(formData);
  const fe = validate(f);
  if (fe) return { fieldErrors: fe };

  const supabase = await createServerClient();
  const { data: affected, error } = await supabase
    .from("schools")
    .update({
      name: f.name,
      level: f.level,
      address: f.address,
      primary_color: f.primaryColor,
      secondary_color: f.secondaryColor,
      logo_url: f.logoUrl,
      active: f.active,
    })
    .eq("id", schoolId)
    .select("id");

  if (error) {
    if (isUniqueViolation(error.message))
      return { fieldErrors: { name: "A school with this name already exists." } };
    return { error: error.message };
  }

  // RLS filters rather than errors: zero rows means the row is
  // outside this admin's scope (or gone). Without this, the action
  // reports success and writes an audit_log entry for a change that
  // never happened.
  if (!affected || affected.length === 0) {
    return { error: "That school is no longer in your scope." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "school.update",
    target_scope: { school_id: schoolId },
    metadata: { name: f.name, level: f.level, active: f.active },
    district_id: f.districtId || null,
    school_id: schoolId,
  });

  if (f.districtId) revalidatePath(`/admin/districts/${f.districtId}`);
  revalidatePath(`/admin/districts/${f.districtId}/schools/${schoolId}`);
  revalidatePath("/district/schools");
  return { success: "Saved." };
}
