/**
 * Pinned-exemplar reads (chunks 6.2 → 6.3).
 *
 *   - listPinnedForAssignment: pins on an assignment, joined with the
 *     exemplar row. Returns published and draft pins so the teacher
 *     can see "this one's pinned but unpublished" state.
 *   - listPinnableForTeacher: teacher's own published exemplars +
 *     same-school colleagues' shared exemplars in matching mode.
 *     Each row carries ownedByViewer / authorName so the picker can
 *     render "Shared by …" sub-labels.
 *
 * Sort: (position ASC, pinned_at ASC) for pinned; updated_at desc for
 * pinnable.
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
  ownedByViewer: boolean;
  authorName: string | null;
}

export interface PinnableExemplarOption {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  ownedByViewer: boolean;
  authorName: string | null;
}

interface AuthorEmbed {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

function formatAuthorName(author: AuthorEmbed | null): string | null {
  if (!author) return null;
  const name = [author.first_name, author.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || author.email || null;
}

export async function listPinnedForAssignment(
  assignmentId: string,
  viewerId: string
): Promise<PinnedExemplarRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("assignment_exemplars")
    .select(
      `
      exemplar_id, position, pinned_at,
      exemplar:exemplar_id (
        id, title, description, mode, is_published, created_by,
        author:created_by ( first_name, last_name, email )
      )
      `
    )
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true })
    .order("pinned_at", { ascending: true });

  if (error) {
    console.error("assignment-exemplars.listPinnedForAssignment:", error);
    return [];
  }

  type ExemplarEmbed = {
    id: string;
    title: string;
    description: string | null;
    mode: Mode;
    is_published: boolean;
    created_by: string | null;
    author: AuthorEmbed | AuthorEmbed[] | null;
  };
  type Row = {
    exemplar_id: string;
    position: number;
    pinned_at: string;
    exemplar: ExemplarEmbed | ExemplarEmbed[] | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  return rows
    .map((r) => {
      const ex = Array.isArray(r.exemplar) ? r.exemplar[0] : r.exemplar;
      if (!ex) return null;
      const author = Array.isArray(ex.author) ? ex.author[0] : ex.author;
      return {
        exemplar_id: r.exemplar_id,
        title: ex.title,
        description: ex.description,
        mode: ex.mode,
        is_published: ex.is_published,
        position: r.position,
        pinned_at: r.pinned_at,
        ownedByViewer: ex.created_by === viewerId,
        authorName: formatAuthorName(author ?? null),
      } satisfies PinnedExemplarRow;
    })
    .filter((r): r is PinnedExemplarRow => r !== null);
}

/**
 * Returns exemplars the teacher can pin: own published exemplars +
 * same-school colleagues' shared exemplars. Both restricted to the
 * assignment's mode.
 *
 * Owned pins require is_published (consistent with what students see
 * via the own-teacher path). Shared pins do NOT require is_published —
 * teachers can pin a shared draft for the peer-preview workflow
 * (audit decision α). Students still gated by is_published via the
 * via-pin policy.
 */
export async function listPinnableForTeacher(
  teacherId: string,
  mode: Mode
): Promise<PinnableExemplarOption[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select(
      `
      id, title, description, updated_at, is_published, shared_with_school,
      created_by,
      author:created_by ( first_name, last_name, email )
      `
    )
    .eq("mode", mode)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("assignment-exemplars.listPinnableForTeacher:", error);
    return [];
  }

  type AuthorEmbedRow = AuthorEmbed | AuthorEmbed[] | null;
  type Row = {
    id: string;
    title: string;
    description: string | null;
    updated_at: string;
    is_published: boolean;
    shared_with_school: boolean;
    created_by: string | null;
    author: AuthorEmbedRow;
  };

  const rows = (data ?? []) as unknown as Row[];

  return rows
    .filter((r) => {
      const owned = r.created_by === teacherId;
      // Own: require published.
      if (owned) return r.is_published;
      // Shared (any publish state per α): RLS already restricted to
      // same school + shared=true, so just trust the row's presence.
      return r.shared_with_school;
    })
    .map((r) => {
      const author = Array.isArray(r.author) ? r.author[0] : r.author;
      const owned = r.created_by === teacherId;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        updated_at: r.updated_at,
        ownedByViewer: owned,
        authorName: formatAuthorName(author ?? null),
      } satisfies PinnableExemplarOption;
    });
}
