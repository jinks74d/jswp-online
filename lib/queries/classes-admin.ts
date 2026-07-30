/**
 * Admin-side class read queries (level 2 of Subject -> Class -> Period).
 * Distinct from lib/queries/classes.ts, which is the teacher-facing
 * class-period view. RLS scopes reads to the caller's school/district.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { Classes } from "@/lib/database.types";

export type ClassListRow = Pick<Classes, "id" | "name" | "created_at">;

export async function listClassesForSubject(
  subjectId: string
): Promise<ClassListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, created_at")
    .eq("subject_id", subjectId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load classes: ${error.message}`);
  return (data ?? []) as ClassListRow[];
}

export async function getClass(id: string): Promise<Classes | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load class: ${error.message}`);
  return (data as Classes | null) ?? null;
}
