/**
 * Exemplar reads (chunk 6.1).
 *
 * Three small helpers covering the surfaces we ship:
 *   - listForTeacher: teacher's own exemplars (for /dashboard/exemplars).
 *   - getForTeacher: single exemplar for edit page; null if not the
 *     author. RLS handles cross-tenant — this just adds the ownership
 *     check as belt-and-suspenders.
 *   - listForStudentByMode: student-side read, filtered by mode. RLS
 *     restricts to published exemplars from the student's teacher set;
 *     this query layers the mode filter on top.
 *
 * Sort order on lists: most-recently-updated first.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Exemplars, Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

export type ExemplarListItem = Pick<
  Exemplars,
  "id" | "title" | "mode" | "description" | "is_published" | "updated_at"
>;

export type ExemplarForEdit = Pick<
  Exemplars,
  | "id"
  | "title"
  | "description"
  | "mode"
  | "full_text"
  | "is_published"
  | "created_at"
  | "updated_at"
  | "created_by"
>;

export type ExemplarForStudent = Pick<
  Exemplars,
  "id" | "title" | "description" | "full_text" | "updated_at"
>;

export async function listForTeacher(
  teacherId: string
): Promise<ExemplarListItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select("id, title, mode, description, is_published, updated_at")
    .eq("created_by", teacherId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("exemplars.listForTeacher:", error);
    return [];
  }
  return (data ?? []) as ExemplarListItem[];
}

export async function getForTeacher(
  exemplarId: string,
  teacherId: string
): Promise<ExemplarForEdit | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select(
      "id, title, description, mode, full_text, is_published, created_at, updated_at, created_by"
    )
    .eq("id", exemplarId)
    .eq("created_by", teacherId)
    .maybeSingle();
  if (error) {
    console.error("exemplars.getForTeacher:", error);
    return null;
  }
  return (data as ExemplarForEdit) ?? null;
}

export async function listForStudentByMode(
  mode: Mode
): Promise<ExemplarForStudent[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select("id, title, description, full_text, updated_at")
    .eq("mode", mode)
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("exemplars.listForStudentByMode:", error);
    return [];
  }
  return (data ?? []) as ExemplarForStudent[];
}
