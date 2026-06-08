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
import { normalizeSchoolLevel } from "@/lib/school-levels";

export type SchoolFormState = {
  error?: string;
  fieldErrors?: { name?: string; level?: string };
  success?: string;
};

const MANAGE_ROLES = ["super_admin", "district_admin"] as const;

function parseSchoolForm(formData: FormData) {
  const levelRaw = String(formData.get("level") ?? "").trim();
  return {
    districtId: String(formData.get("district_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    levelRaw,
    // Canonical slugs pass through unchanged; custom "Other…" text is slugified
    // and capped to the 20-char column. See lib/school-levels.ts.
    level: normalizeSchoolLevel(levelRaw),
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
  return Object.keys(fe).length ? fe : null;
}

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createSchool(
  _prev: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const f = parseSchoolForm(formData);
  if (!f.districtId) return { error: "Missing district id." };

  const fe = validate(f);
  if (fe) return { fieldErrors: fe };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      district_id: f.districtId,
      name: f.name,
      level: f.level,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return { fieldErrors: { name: "A school with this name already exists." } };
    return { error: error?.message ?? "Could not create the school." };
  }

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: "school.create",
      target_scope: { school_id: data.id },
      metadata: { name: f.name, level: f.level },
      district_id: f.districtId,
      school_id: data.id,
    });

  revalidatePath(`/admin/districts/${f.districtId}`);
  return { success: `Created “${f.name}”.` };
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
  const { error } = await supabase
    .from("schools")
    .update({ name: f.name, level: f.level, active: f.active })
    .eq("id", schoolId);

  if (error) {
    if (isUniqueViolation(error.message))
      return { fieldErrors: { name: "A school with this name already exists." } };
    return { error: error.message };
  }

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: "school.update",
      target_scope: { school_id: schoolId },
      metadata: { name: f.name, level: f.level, active: f.active },
      district_id: f.districtId || null,
      school_id: schoolId,
    });

  if (f.districtId) revalidatePath(`/admin/districts/${f.districtId}`);
  revalidatePath(`/admin/districts/${f.districtId}/schools/${schoolId}`);
  return { success: "Saved." };
}
