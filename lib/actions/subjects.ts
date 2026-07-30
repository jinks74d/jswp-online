/**
 * Subject management server actions (super / district / school admin in scope).
 * Writes via the RLS server client (subjects_admin_manage enforces scope);
 * requireRole is defense-in-depth. audit_log via the service role.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";

export type SubjectFormState = {
  error?: string;
  fieldErrors?: { name?: string };
  success?: string;
};

const MANAGE_ROLES = ["super_admin", "district_admin", "school_admin"] as const;

function parseSubjectForm(formData: FormData) {
  return {
    schoolId: String(formData.get("school_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    description:
      String(formData.get("description") ?? "").trim() || null,
  };
}

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createSubject(
  _prev: SubjectFormState,
  formData: FormData
): Promise<SubjectFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const f = parseSubjectForm(formData);
  if (!f.schoolId) return { error: "Missing school id." };
  if (!f.name) return { fieldErrors: { name: "Subject name is required." } };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ school_id: f.schoolId, name: f.name, description: f.description })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return { fieldErrors: { name: "A subject with this name already exists." } };
    return { error: error?.message ?? "Could not create the subject." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "subject.create",
    target_scope: { subject_id: data.id, school_id: f.schoolId },
    metadata: { name: f.name },
    school_id: f.schoolId,
  });

  revalidatePath(`/admin/districts`);
  return { success: `Created “${f.name}”.` };
}

export async function updateSubject(
  _prev: SubjectFormState,
  formData: FormData
): Promise<SubjectFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const subjectId = String(formData.get("subject_id") ?? "");
  if (!subjectId) return { error: "Missing subject id." };

  const f = parseSubjectForm(formData);
  if (!f.name) return { fieldErrors: { name: "Subject name is required." } };

  const supabase = await createServerClient();
  const { data: affected, error } = await supabase
    .from("subjects")
    .update({ name: f.name, description: f.description })
    .eq("id", subjectId)
    .select("id");

  if (error) {
    if (isUniqueViolation(error.message))
      return { fieldErrors: { name: "A subject with this name already exists." } };
    return { error: error.message };
  }

  // RLS filters rather than errors: zero rows means the row is
  // outside this admin's scope (or gone). Without this, the action
  // reports success and writes an audit_log entry for a change that
  // never happened.
  if (!affected || affected.length === 0) {
    return { error: "That subject is no longer in your scope." };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "subject.update",
    target_scope: { subject_id: subjectId },
    metadata: { name: f.name },
    school_id: f.schoolId || null,
  });

  revalidatePath(`/admin/districts`);
  return { success: "Saved." };
}
