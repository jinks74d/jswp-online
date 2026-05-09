/**
 * Read-only queries for the student portal. RLS does the scoping —
 * a student only sees assignments they're enrolled in (and that are
 * released, per migration 0008) and only their own student_writings.
 *
 * Each list/detail item carries a derived `status` derived from the
 * presence + DB status of the student's writing row:
 *   no row              → 'not_started'
 *   row.status='draft'   → 'in_progress'    (just created or barely started)
 *   row.status='in_progress' → 'in_progress'
 *   row.status='submitted'   → 'submitted'
 *   row.status='returned'    → 'returned'    (teacher kicked it back)
 *   row.status='graded'      → 'graded'
 *
 * The CTA on the detail page is keyed off this derived status — see
 * components/student/assignment-card.tsx and the detail page itself.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

export type DerivedStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "returned"
  | "graded";

export interface StudentAssignmentListItem {
  id: string;
  title: string;
  mode: Mode;
  due_at: string | null;
  released_at: string | null;
  has_source_text: boolean;
  status: DerivedStatus;
  writing: {
    id: string;
    draft_number: number;
    submitted_at: string | null;
    graded_at: string | null;
    total_score: number | null;
  } | null;
}

export interface StudentAssignmentDetail {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  is_essay: boolean;
  num_body_paragraphs: number;
  has_counterargument: boolean;
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  rubric: Database["public"]["Tables"]["assignments"]["Row"]["rubric"];
  due_at: string | null;
  released_at: string | null;
  status: DerivedStatus;
  writing: {
    id: string;
    draft_number: number;
    submitted_at: string | null;
    graded_at: string | null;
    total_score: number | null;
  } | null;
}

/* ─── Internal helpers ───────────────────────────────────────────────── */

function deriveStatus(dbStatus: WritingStatus | null): DerivedStatus {
  if (dbStatus === null) return "not_started";
  // 'draft' is the default after row creation; treat as in_progress for the
  // student-facing badge so they don't see two "started" labels.
  if (dbStatus === "draft" || dbStatus === "in_progress") return "in_progress";
  return dbStatus; // 'submitted' | 'returned' | 'graded'
}

interface RawWriting {
  id: string;
  assignment_id: string;
  draft_number: number;
  status: WritingStatus;
  submitted_at: string | null;
  graded_at: string | null;
  total_score: number | null;
}

// For each assignment, find the student's latest draft (highest draft_number).
// Multiple drafts share an assignment_id; we keep the latest.
function indexWritingsByAssignment(
  writings: RawWriting[]
): Map<string, RawWriting> {
  const m = new Map<string, RawWriting>();
  for (const w of writings) {
    const cur = m.get(w.assignment_id);
    if (!cur || w.draft_number > cur.draft_number) {
      m.set(w.assignment_id, w);
    }
  }
  return m;
}

/* ─── Queries ────────────────────────────────────────────────────────── */

export async function getStudentAssignmentsList(
  studentId: string
): Promise<StudentAssignmentListItem[]> {
  const supabase = await createServerClient();

  const [assignmentsRes, writingsRes] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, title, mode, due_at, released_at, source_text"
      )
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("student_writings")
      .select(
        "id, assignment_id, draft_number, status, submitted_at, graded_at, total_score"
      )
      .eq("student_id", studentId),
  ]);

  if (assignmentsRes.error) {
    console.error("getStudentAssignmentsList assignments:", assignmentsRes.error);
    return [];
  }
  if (writingsRes.error) {
    console.error("getStudentAssignmentsList writings:", writingsRes.error);
    return [];
  }

  const writingByAssignment = indexWritingsByAssignment(
    (writingsRes.data ?? []) as RawWriting[]
  );

  return (assignmentsRes.data ?? []).map((a) => {
    const w = writingByAssignment.get(a.id) ?? null;
    return {
      id: a.id,
      title: a.title,
      mode: a.mode,
      due_at: a.due_at,
      released_at: a.released_at,
      has_source_text: !!a.source_text,
      status: deriveStatus(w?.status ?? null),
      writing: w
        ? {
            id: w.id,
            draft_number: w.draft_number,
            submitted_at: w.submitted_at,
            graded_at: w.graded_at,
            total_score: w.total_score,
          }
        : null,
    };
  });
}

export async function getStudentAssignmentDetail(
  assignmentId: string,
  studentId: string
): Promise<StudentAssignmentDetail | null> {
  const supabase = await createServerClient();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .select(
      `id, title, prompt, mode, is_essay, num_body_paragraphs,
       has_counterargument, source_text, source_title, source_author,
       source_citation, source_url, rubric, due_at, released_at`
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    console.error("getStudentAssignmentDetail assignment:", error);
    return null;
  }
  if (!assignment) return null;

  const { data: writings, error: writingsError } = await supabase
    .from("student_writings")
    .select(
      "id, assignment_id, draft_number, status, submitted_at, graded_at, total_score"
    )
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("draft_number", { ascending: false })
    .limit(1);

  if (writingsError) {
    console.error("getStudentAssignmentDetail writing:", writingsError);
    return null;
  }

  const w = (writings?.[0] ?? null) as RawWriting | null;

  return {
    ...assignment,
    status: deriveStatus(w?.status ?? null),
    writing: w
      ? {
          id: w.id,
          draft_number: w.draft_number,
          submitted_at: w.submitted_at,
          graded_at: w.graded_at,
          total_score: w.total_score,
        }
      : null,
  };
}

/* ─── Status grouping helper for the landing page ────────────────────── */

export function groupByStatus(
  items: readonly StudentAssignmentListItem[]
): Record<DerivedStatus, StudentAssignmentListItem[]> {
  const groups: Record<DerivedStatus, StudentAssignmentListItem[]> = {
    not_started: [],
    in_progress: [],
    submitted: [],
    returned: [],
    graded: [],
  };
  for (const it of items) groups[it.status].push(it);
  return groups;
}
