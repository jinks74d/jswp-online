"use server";

/**
 * Pin/unpin server actions for assignment ↔ exemplar (chunk 6.2).
 *
 * RLS handles the substantive gating:
 *   - assignment_exemplars_teacher_all USING + WITH CHECK both require
 *     the caller to own the assignment.
 *   - WITH CHECK also requires the caller to own the exemplar.
 *
 * The actions add a defense-in-depth role gate before hitting RLS.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const TEACHER_ROLES: (
  | "teacher"
  | "school_admin"
  | "district_admin"
  | "super_admin"
)[] = ["teacher", "school_admin", "district_admin", "super_admin"];

export async function pinExemplar(
  assignmentId: string,
  exemplarId: string
): Promise<void> {
  const profile = await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();

  const { error } = await supabase.from("assignment_exemplars").insert({
    assignment_id: assignmentId,
    exemplar_id: exemplarId,
    pinned_by: profile.id,
  });

  // 23505 is unique violation — pin already exists. Idempotent: silent.
  if (error && error.code !== "23505") {
    throw new Error(`Could not pin exemplar: ${error.message}`);
  }

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
}

export async function unpinExemplar(
  assignmentId: string,
  exemplarId: string
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("assignment_exemplars")
    .delete()
    .eq("assignment_id", assignmentId)
    .eq("exemplar_id", exemplarId);

  if (error) {
    throw new Error(`Could not unpin exemplar: ${error.message}`);
  }

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
}
