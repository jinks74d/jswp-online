/**
 * Class management server actions (super / district / school admin in scope).
 * A class belongs to a subject; school_id is derived from the subject (read
 * via RLS, which also validates scope). Writes ride classes_admin_manage;
 * audit_log via the service role.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClassFormState = {
  error?: string;
  fieldErrors?: { name?: string };
  success?: string;
};

const MANAGE_ROLES = ["super_admin", "district_admin", "school_admin"] as const;

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createClass(
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const subjectId = String(formData.get("subject_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!subjectId) return { error: "Missing subject id." };
  if (!name) return { fieldErrors: { name: "Class name is required." } };

  const supabase = await createServerClient();
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, school_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return { error: "Subject not found or outside your scope." };

  const { data, error } = await supabase
    .from("classes")
    .insert({ subject_id: subject.id, school_id: subject.school_id, name })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return { fieldErrors: { name: "A class with this name already exists." } };
    return { error: error?.message ?? "Could not create the class." };
  }

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: "class.create",
      target_scope: { class_id: data.id, subject_id: subject.id },
      metadata: { name },
      school_id: subject.school_id,
    });

  revalidatePath(`/admin/districts`);
  return { success: `Created “${name}”.` };
}

export async function updateClass(
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const classId = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!classId) return { error: "Missing class id." };
  if (!name) return { fieldErrors: { name: "Class name is required." } };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("classes")
    .update({ name })
    .eq("id", classId);

  if (error) {
    if (isUniqueViolation(error.message))
      return { fieldErrors: { name: "A class with this name already exists." } };
    return { error: error.message };
  }

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: "class.update",
      target_scope: { class_id: classId },
      metadata: { name },
    });

  revalidatePath(`/admin/districts`);
  return { success: "Saved." };
}
