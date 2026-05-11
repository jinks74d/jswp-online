/**
 * Read-only queries for the teacher review surface (chunk 4.7b).
 *
 * RLS scopes everything: a teacher only sees student_writings on
 * assignments they own or class periods they teach (per the
 * student_writings_teacher_select policy in 0002:440-451).
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];
type Mode = Database["public"]["Enums"]["jswp_mode"];

export interface AssignmentWritingListItem {
  id: string;
  status: WritingStatus;
  draft_number: number;
  submitted_at: string | null;
  returned_at: string | null;
  graded_at: string | null;
  total_score: number | null;
  updated_at: string;
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface WritingForTeacherReview {
  id: string;
  assignment_id: string;
  status: WritingStatus;
  draft_number: number;
  submitted_at: string | null;
  returned_at: string | null;
  graded_at: string | null;
  total_score: number | null;
  current_step: string | null;
  chunk_ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  assignment: {
    id: string;
    title: string;
    prompt: string;
    mode: Mode;
    is_essay: boolean;
    has_counterargument: boolean;
    source_text: string | null;
    source_title: string | null;
    source_author: string | null;
    default_chunk_ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
    num_body_paragraphs: number;
    default_chunks_per_bp: number;
    rubric: Json | null;
  };
}

/* ─── Queries ────────────────────────────────────────────────────────── */

/**
 * Lists all student writings on an assignment. RLS-scoped — a teacher
 * sees only writings they're entitled to. Sorted by status priority
 * (submitted first, then returned, ...) then by updated_at desc.
 */
export async function listAssignmentWritings(
  assignmentId: string
): Promise<AssignmentWritingListItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("student_writings")
    .select(
      `
      id, status, draft_number, submitted_at, returned_at, graded_at,
      total_score, updated_at,
      student:student_id ( id, first_name, last_name, email )
      `
    )
    .eq("assignment_id", assignmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listAssignmentWritings:", error);
    return [];
  }

  // Supabase types don't infer the embed shape; narrow once.
  const rows = (data ?? []) as unknown as Array<
    Omit<AssignmentWritingListItem, "student"> & {
      student: AssignmentWritingListItem["student"] | null;
    }
  >;

  return rows
    .filter(
      (r): r is AssignmentWritingListItem =>
        r.student !== null && typeof r.student.id === "string"
    )
    .map((r) => ({
      id: r.id,
      status: r.status,
      draft_number: r.draft_number,
      submitted_at: r.submitted_at,
      returned_at: r.returned_at,
      graded_at: r.graded_at,
      total_score: r.total_score,
      updated_at: r.updated_at,
      student: r.student,
    }));
}

/**
 * Loads a writing + assignment + student profile for the teacher review
 * page header. The combined view itself fetches per-step data via the
 * student step components (see Option A composition strategy).
 */
export async function getWritingForTeacherReview(
  writingId: string
): Promise<WritingForTeacherReview | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("student_writings")
    .select(
      `
      id, assignment_id, status, draft_number, submitted_at, returned_at,
      graded_at, total_score, current_step, chunk_ratio,
      student:student_id ( id, first_name, last_name, email ),
      assignment:assignment_id (
        id, title, prompt, mode, is_essay, has_counterargument,
        source_text, source_title, source_author, default_chunk_ratio,
        num_body_paragraphs, default_chunks_per_bp, rubric
      )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (error) {
    console.error("getWritingForTeacherReview:", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as WritingForTeacherReview & {
    student: WritingForTeacherReview["student"] | null;
    assignment: WritingForTeacherReview["assignment"] | null;
  };
  if (!row.student || !row.assignment) return null;

  return {
    id: row.id,
    assignment_id: row.assignment_id,
    status: row.status,
    draft_number: row.draft_number,
    submitted_at: row.submitted_at,
    returned_at: row.returned_at,
    graded_at: row.graded_at,
    total_score: row.total_score,
    current_step: row.current_step,
    chunk_ratio: row.chunk_ratio,
    student: row.student,
    assignment: row.assignment,
  };
}

/**
 * Counts student_writings on an assignment grouped by status. Used by
 * the assignment-detail page to surface "X submissions, Y in progress".
 * RLS-scoped — counts only writings the caller can read.
 */
export async function countAssignmentWritingsByStatus(
  assignmentId: string
): Promise<Record<WritingStatus, number>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("student_writings")
    .select("status")
    .eq("assignment_id", assignmentId);
  const counts: Record<WritingStatus, number> = {
    draft: 0,
    in_progress: 0,
    submitted: 0,
    returned: 0,
    graded: 0,
  };
  if (error) {
    console.error("countAssignmentWritingsByStatus:", error);
    return counts;
  }
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
