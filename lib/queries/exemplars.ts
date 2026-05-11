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

/**
 * Student-side exemplars for a writing (chunk 6.2).
 *
 * Branches:
 *   1. Try pinned exemplars on the assignment first. If ≥1 visible
 *      published exemplar in matching mode, return them in
 *      (position ASC, pinned_at ASC) order.
 *   2. Otherwise, fall back to 6.1's mode-default — all published
 *      exemplars in matching mode the student can read (RLS-scoped
 *      to the student's teacher set + the via-pin path).
 *
 * RLS does the heavy lifting; this query just shapes the response.
 */
export async function getExemplarsForStudent(
  assignmentId: string,
  mode: Mode
): Promise<ExemplarForStudent[]> {
  const supabase = await createServerClient();

  // Pinned-first.
  const { data: pinnedData, error: pinnedErr } = await supabase
    .from("assignment_exemplars")
    .select(
      `
      position, pinned_at,
      exemplar:exemplar_id (
        id, title, description, full_text, updated_at, mode, is_published
      )
      `
    )
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true })
    .order("pinned_at", { ascending: true });

  if (pinnedErr) {
    console.error("exemplars.getExemplarsForStudent (pinned):", pinnedErr);
  }

  type PinRow = {
    position: number;
    pinned_at: string;
    exemplar:
      | {
          id: string;
          title: string;
          description: string | null;
          full_text: string;
          updated_at: string;
          mode: Mode;
          is_published: boolean;
        }
      | Array<{
          id: string;
          title: string;
          description: string | null;
          full_text: string;
          updated_at: string;
          mode: Mode;
          is_published: boolean;
        }>
      | null;
  };

  const pinnedRows = (pinnedData ?? []) as unknown as PinRow[];
  const pinnedVisible: ExemplarForStudent[] = pinnedRows
    .map((r) => {
      const ex = Array.isArray(r.exemplar) ? r.exemplar[0] : r.exemplar;
      if (!ex) return null;
      // Defense in depth: enforce mode + published at the app layer too.
      // RLS already restricts what the student can read, but the join
      // could surface a pin row whose exemplar got unpublished or whose
      // mode drifted (impossible today since mode is fixed at create,
      // but cheap to guard).
      if (!ex.is_published) return null;
      if (ex.mode !== mode) return null;
      return {
        id: ex.id,
        title: ex.title,
        description: ex.description,
        full_text: ex.full_text,
        updated_at: ex.updated_at,
      } satisfies ExemplarForStudent;
    })
    .filter((r): r is ExemplarForStudent => r !== null);

  if (pinnedVisible.length > 0) {
    return pinnedVisible;
  }

  // Fallback: mode-default (6.1 behavior preserved).
  const { data, error } = await supabase
    .from("exemplars")
    .select("id, title, description, full_text, updated_at")
    .eq("mode", mode)
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("exemplars.getExemplarsForStudent (fallback):", error);
    return [];
  }
  return (data ?? []) as ExemplarForStudent[];
}
