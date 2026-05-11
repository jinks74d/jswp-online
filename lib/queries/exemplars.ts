/**
 * Exemplar reads (chunks 6.1 → 6.3).
 *
 *   - listForViewer: teacher's own exemplars + same-school shared
 *     exemplars by colleagues. Each row is annotated with ownedByViewer
 *     so the UI can render read-only chrome for shared ones. Single
 *     chronological list (most-recently-updated first).
 *   - getForViewer: single exemplar by id; resolves owner vs reader
 *     view. Returns null if the caller can't see it (RLS).
 *   - getExemplarsForStudent: per-writing read; tries pinned first,
 *     falls back to mode-default. Shape unchanged from 6.2.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { MODES, type JswpMode } from "@/lib/jswp-modes";
import { isStepTag } from "@/lib/exemplar-limits";
import type { Exemplars, Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

/** Look up the GroupOrigin (step-tag candidate) for a current_step
 * key like "expository.thesis". Returns null when the step key isn't
 * tag-relevant or doesn't resolve. */
function groupOriginForStepKey(stepKey: string | null): string | null {
  if (!stepKey) return null;
  const [modeName] = stepKey.split(".");
  if (!modeName) return null;
  const modeConfig = (MODES as Record<string, { steps: ReadonlyArray<{ key: string; groupOrigin: string }> } | undefined>)[modeName];
  if (!modeConfig) return null;
  const step = modeConfig.steps.find((s) => s.key === stepKey);
  if (!step) return null;
  return isStepTag(step.groupOrigin) ? step.groupOrigin : null;
}

export type ExemplarListItem = Pick<
  Exemplars,
  | "id"
  | "title"
  | "mode"
  | "description"
  | "is_published"
  | "shared_with_school"
  | "updated_at"
  | "created_by"
  | "step_tags"
> & {
  ownedByViewer: boolean;
  authorName: string | null;
};

export type ExemplarForViewer = Pick<
  Exemplars,
  | "id"
  | "title"
  | "description"
  | "mode"
  | "full_text"
  | "is_published"
  | "shared_with_school"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "step_tags"
> & {
  ownedByViewer: boolean;
  authorName: string | null;
};

export type ExemplarForStudent = Pick<
  Exemplars,
  "id" | "title" | "description" | "full_text" | "updated_at"
> & {
  /** True when the exemplar was kept because its step_tags include
   * the student's current step. False when the row survives via the
   * fallback path (no step match in the candidate pool, or no
   * current step). Used to render the "matched to current step"
   * badge in ExemplarReference. */
  matchedCurrentStep: boolean;
};

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

export type StepFilter = "all" | "untagged" | string;

/**
 * Lists every exemplar the viewer can see in /dashboard/exemplars:
 * own rows (any state) plus same-school shared rows (any publish state,
 * per 6.3 α). Sorted by updated_at desc, mixed.
 *
 * stepFilter narrows the result:
 *   - "all" / undefined: every visible row
 *   - "untagged": rows where step_tags IS NULL or empty
 *   - <tag>: rows where step_tags @> [tag]
 *
 * Filter is applied app-side after the RLS fetch — small data volumes
 * make the partial GIN index value moot for the dashboard list.
 */
export async function listForViewer(
  viewerId: string,
  stepFilter: StepFilter = "all"
): Promise<ExemplarListItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select(
      `
      id, title, mode, description, is_published, shared_with_school,
      updated_at, created_by, step_tags,
      author:created_by ( first_name, last_name, email )
      `
    )
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("exemplars.listForViewer:", error);
    return [];
  }

  type Row = Omit<ExemplarListItem, "ownedByViewer" | "authorName"> & {
    author: AuthorEmbed | AuthorEmbed[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const filtered = rows.filter((r) => {
    if (stepFilter === "all") return true;
    if (stepFilter === "untagged") {
      return !r.step_tags || r.step_tags.length === 0;
    }
    return Array.isArray(r.step_tags) && r.step_tags.includes(stepFilter);
  });

  return filtered.map((r) => {
    const author = Array.isArray(r.author) ? r.author[0] : r.author;
    return {
      id: r.id,
      title: r.title,
      mode: r.mode,
      description: r.description,
      is_published: r.is_published,
      shared_with_school: r.shared_with_school,
      updated_at: r.updated_at,
      created_by: r.created_by,
      step_tags: r.step_tags,
      ownedByViewer: r.created_by === viewerId,
      authorName: formatAuthorName(author ?? null),
    };
  });
}

export async function getForViewer(
  exemplarId: string,
  viewerId: string
): Promise<ExemplarForViewer | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .select(
      `
      id, title, description, mode, full_text, is_published,
      shared_with_school, created_at, updated_at, created_by, step_tags,
      author:created_by ( first_name, last_name, email )
      `
    )
    .eq("id", exemplarId)
    .maybeSingle();
  if (error) {
    console.error("exemplars.getForViewer:", error);
    return null;
  }
  if (!data) return null;

  type Row = Omit<ExemplarForViewer, "ownedByViewer" | "authorName"> & {
    author: AuthorEmbed | AuthorEmbed[] | null;
  };
  const row = data as unknown as Row;
  const author = Array.isArray(row.author) ? row.author[0] : row.author;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    full_text: row.full_text,
    is_published: row.is_published,
    shared_with_school: row.shared_with_school,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    step_tags: row.step_tags,
    ownedByViewer: row.created_by === viewerId,
    authorName: formatAuthorName(author ?? null),
  };
}

export interface WritingPrefillData {
  full_text: string;
  mode: Mode;
  studentName: string;
  assignmentTitle: string;
}

/**
 * Promote-to-exemplar prefill (chunk 6.4).
 *
 * Returns a snapshot of a writing's final_draft suitable for
 * pre-populating /dashboard/exemplars/new. Returns null if:
 *   - The writing doesn't exist or the teacher can't see it (RLS
 *     gates via student_writings_teacher_select).
 *   - No final_drafts row yet (student hasn't assembled the essay).
 *   - The final_draft's full_text trims to empty.
 *
 * The returned data is a copy at promotion time. Subsequent edits
 * to the student's final_draft don't propagate to any exemplar
 * created from this snapshot — exemplars are curated content, not
 * live mirrors.
 *
 * teacherId is intentionally unused at the SQL layer (RLS handles
 * the scope). It's kept in the signature so callers can't forget
 * the access context.
 */
export async function getWritingPrefillData(
  writingId: string,
  _teacherId: string
): Promise<WritingPrefillData | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("student_writings")
    .select(
      `
      id,
      student:student_id ( first_name, last_name, email ),
      assignment:assignment_id ( title, mode ),
      final_draft:final_drafts ( full_text )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (error) {
    console.error("exemplars.getWritingPrefillData:", error);
    return null;
  }
  if (!data) return null;

  type Row = {
    id: string;
    student:
      | { first_name: string | null; last_name: string | null; email: string | null }
      | Array<{
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }>
      | null;
    assignment:
      | { title: string; mode: Mode }
      | Array<{ title: string; mode: Mode }>
      | null;
    final_draft:
      | { full_text: string }
      | Array<{ full_text: string }>
      | null;
  };
  const row = data as unknown as Row;

  const student = Array.isArray(row.student) ? row.student[0] : row.student;
  const assignment = Array.isArray(row.assignment)
    ? row.assignment[0]
    : row.assignment;
  const finalDraft = Array.isArray(row.final_draft)
    ? row.final_draft[0]
    : row.final_draft;

  if (!assignment || !finalDraft) return null;
  const trimmed = finalDraft.full_text.trim();
  if (trimmed.length === 0) return null;

  const studentName = student
    ? [student.first_name, student.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      student.email ||
      "this student"
    : "this student";

  return {
    full_text: finalDraft.full_text,
    mode: assignment.mode,
    studentName,
    assignmentTitle: assignment.title,
  };
}

/**
 * Returns true when a writing has a non-empty final_draft. Used by
 * the teacher review surface to gate the [Promote to Exemplar]
 * button without pulling the full content. RLS-scoped.
 */
export async function hasFinalDraftForPromotion(
  writingId: string
): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("final_drafts")
    .select("full_text")
    .eq("student_writing_id", writingId)
    .maybeSingle();
  if (error) {
    console.error("exemplars.hasFinalDraftForPromotion:", error);
    return false;
  }
  if (!data) return false;
  return data.full_text.trim().length > 0;
}

/**
 * Student-side exemplars for a writing (chunks 6.2 + 6.5).
 *
 * Two-stage filter:
 *   Stage 1 (candidate pool):
 *     - Try pinned exemplars on the assignment first.
 *     - If no pins: fall back to mode-default (all published in
 *       matching mode the student can read).
 *   Stage 2 (step-aware narrowing):
 *     - currentStepKey → groupOrigin via lib/jswp-modes lookup
 *     - If at least one candidate has step_tags containing that
 *       groupOrigin, return only the matched candidates (each
 *       flagged matchedCurrentStep = true).
 *     - Otherwise return the full candidate pool (each flagged
 *       matchedCurrentStep = false) — preserves 6.1's "panel
 *       never disappears" UX.
 *
 * RLS does the heavy lifting; this query shapes + filters.
 *
 * Edge case (BACKLOG): currentStepKey comes from writing.current_step
 * which is persisted on save/navigateToStep. If a student backwards-
 * navigates by URL without going through the sidebar, the URL [step]
 * may briefly diverge. v1 uses the persisted value — practical for
 * the canonical navigation path.
 */
export async function getExemplarsForStudent(
  assignmentId: string,
  mode: Mode,
  currentStepKey: string | null
): Promise<ExemplarForStudent[]> {
  const supabase = await createServerClient();

  const { data: pinnedData, error: pinnedErr } = await supabase
    .from("assignment_exemplars")
    .select(
      `
      position, pinned_at,
      exemplar:exemplar_id (
        id, title, description, full_text, updated_at, mode, is_published, step_tags
      )
      `
    )
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true })
    .order("pinned_at", { ascending: true });

  if (pinnedErr) {
    console.error("exemplars.getExemplarsForStudent (pinned):", pinnedErr);
  }

  type ExemplarShape = {
    id: string;
    title: string;
    description: string | null;
    full_text: string;
    updated_at: string;
    mode: Mode;
    is_published: boolean;
    step_tags: string[] | null;
  };
  type PinRow = {
    position: number;
    pinned_at: string;
    exemplar: ExemplarShape | ExemplarShape[] | null;
  };

  const pinnedRows = (pinnedData ?? []) as unknown as PinRow[];
  const pinnedCandidates: ExemplarShape[] = pinnedRows
    .map((r) => (Array.isArray(r.exemplar) ? r.exemplar[0] : r.exemplar))
    .filter((ex): ex is ExemplarShape => {
      if (!ex) return false;
      if (!ex.is_published) return false;
      if (ex.mode !== mode) return false;
      return true;
    });

  let candidates: ExemplarShape[];
  if (pinnedCandidates.length > 0) {
    candidates = pinnedCandidates;
  } else {
    const { data, error } = await supabase
      .from("exemplars")
      .select(
        "id, title, description, full_text, updated_at, mode, is_published, step_tags"
      )
      .eq("mode", mode)
      .eq("is_published", true)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("exemplars.getExemplarsForStudent (fallback):", error);
      return [];
    }
    candidates = (data ?? []) as ExemplarShape[];
  }

  const currentStepGroup = groupOriginForStepKey(currentStepKey);
  const matched = currentStepGroup
    ? candidates.filter(
        (c) =>
          Array.isArray(c.step_tags) && c.step_tags.includes(currentStepGroup)
      )
    : [];

  const finalRows = matched.length > 0 ? matched : candidates;
  const hasStepMatch = matched.length > 0;

  return finalRows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    full_text: c.full_text,
    updated_at: c.updated_at,
    matchedCurrentStep: hasStepMatch,
  }));
}
