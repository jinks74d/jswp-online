/**
 * Pinned-exemplar reads (chunk 6.2).
 *
 *   - listPinnedForAssignment: pins on an assignment, joined with the
 *     exemplar row. Used by the teacher's pin-management UI and the
 *     assignment-detail display. Returns both published and draft pins
 *     so the teacher can see "this one's pinned but unpublished" state.
 *   - listPinnableForTeacher: teacher's own published exemplars in a
 *     specific mode. Feeds the picker on the assignment-form.
 *
 * Sort: (position ASC, pinned_at ASC) — earliest pinned first when
 * positions tie. Matches the student-side ordering for consistency.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

export interface PinnedExemplarRow {
  exemplar_id: string;
  title: string;
  description: string | null;
  mode: Mode;
  is_published: boolean;
  position: number;
  pinned_at: string;
}

export interface PinnableExemplarOption {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
}

export async function listPinnedForAssignment(
  assignmentId: string
): Promise<PinnedExemplarRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("assignment_exemplars")
    .select(
      `
      exemplar_id, position, pinned_at,
      exemplar:exemplar_id ( id, title, description, mode, is_published )
      `
    )
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true })
    .order("pinned_at", { ascending: true });

  if (error) {
    console.error("assignment-exemplars.listPinnedForAssignment:", error);
    return [];
  }

  type Row = {
    exemplar_id: string;
    position: number;
    pinned_at: string;
    exemplar:
      | {
          id: string;
          title: string;
          description: string | null;
          mode: Mode;
          is_published: boolean;
        }
      | Array<{
          id: string;
          title: string;
          description: string | null;
          mode: Mode;
          is_published: boolean;
        }>
      | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  return rows
    .map((r) => {
      const ex = Array.isArray(r.exemplar) ? r.exemplar[0] : r.exemplar;
      if (!ex) return null;
      return {
        exemplar_id: r.exemplar_id,
        title: ex.title,
        description: ex.description,
        mode: ex.mode,
        is_published: ex.is_published,
        position: r.position,
        pinned_at: r.pinned_at,
      } satisfies PinnedExemplarRow;
    })
    .filter((r): r is PinnedExemplarRow => r !== null);
}

export async function listPinnableForTeacher(
  teacherId: string,
  mode: Mode
): Promise<PinnableExemplarOption[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select("id, title, description, updated_at")
    .eq("created_by", teacherId)
    .eq("mode", mode)
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("assignment-exemplars.listPinnableForTeacher:", error);
    return [];
  }
  return (data ?? []) as PinnableExemplarOption[];
}
