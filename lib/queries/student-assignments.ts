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
import type { RubricFile } from "@/lib/rubric-file";
import {
  earliestDueAt,
  type PeriodDueDate,
} from "@/lib/assignment-due-dates";

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

export interface StudentSource {
  id: string;
  kind: "primary" | "secondary";
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  source_render_mode: "pdf" | "rich" | "plain" | "image" | null;
  source_html: string | null;
  source_file_path: string | null;
  source_file_name: string | null;
}

export interface StudentAssignmentDetail {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  is_essay: boolean;
  num_body_paragraphs: number;
  has_counterargument: boolean;
  sources: StudentSource[];
  rubric: Database["public"]["Tables"]["assignments"]["Row"]["rubric"];
  /** Attached rubric document, folded from the three rubric_file_* columns. */
  rubric_file: RubricFile | null;
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
      // assignment_class_periods is embedded for the DUE DATE, and its RLS
      // does the per-student work: a student may only read the row for a
      // period they're enrolled in (migration 0050), so whatever comes back
      // here is already this student's own deadline, not another class's.
      .select(
        "id, title, mode, due_at, released_at, assignment_sources(count), assignment_class_periods(class_period_id, due_at)"
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
    throw new Error(
      `getStudentAssignmentsList assignments: ${assignmentsRes.error.message}`
    );
  }
  if (writingsRes.error) {
    throw new Error(
      `getStudentAssignmentsList writings: ${writingsRes.error.message}`
    );
  }

  const writingByAssignment = indexWritingsByAssignment(
    (writingsRes.data ?? []) as RawWriting[]
  );

  const items = (assignmentsRes.data ?? []).map((a) => {
    const w = writingByAssignment.get(a.id) ?? null;
    const sourceCount =
      (a as { assignment_sources?: { count: number }[] }).assignment_sources?.[0]
        ?.count ?? 0;
    const periods =
      (a as { assignment_class_periods?: PeriodDueDate[] })
        .assignment_class_periods ?? [];
    return {
      id: a.id,
      title: a.title,
      mode: a.mode,
      // A student enrolled in two periods that both received this assignment
      // is held to the earlier deadline.
      due_at: earliestDueAt(a.due_at, periods),
      released_at: a.released_at,
      has_source_text: sourceCount > 0,
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

  // The DB ordered by the assignment-level default; re-sort on the deadline
  // the student is actually held to, so a per-class override cannot leave the
  // list claiming a different order than the dates it displays.
  return items.sort(compareByDueAtThenNewest);
}

function compareByDueAtThenNewest(
  a: { due_at: string | null },
  b: { due_at: string | null }
): number {
  if (a.due_at && b.due_at) {
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }
  // Undated work sorts last — it is not what a student needs to act on next.
  if (a.due_at) return -1;
  if (b.due_at) return 1;
  return 0;
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
       has_counterargument, rubric,
       rubric_file_path, rubric_file_name, rubric_file_mime,
       due_at, released_at,
       assignment_class_periods ( class_period_id, due_at ),
       assignment_sources (
         position, id, kind, source_text, source_title, source_author,
         source_citation, source_url, source_render_mode, source_html,
         source_file_path, source_file_name
       )`
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`getStudentAssignmentDetail assignment: ${error.message}`);
  }
  if (!assignment) return null;

  const {
    assignment_sources,
    assignment_class_periods,
    rubric_file_path,
    rubric_file_name,
    rubric_file_mime,
    ...flat
  } = assignment as unknown as Omit<
    StudentAssignmentDetail,
    "sources" | "status" | "writing" | "rubric_file"
  > & {
    assignment_sources?: (StudentSource & { position: number })[];
    assignment_class_periods?: PeriodDueDate[];
    rubric_file_path: string | null;
    rubric_file_name: string | null;
    rubric_file_mime: string | null;
  };

  // RLS narrowed this to the student's own period(s) — see the list query.
  const dueAt = earliestDueAt(flat.due_at, assignment_class_periods ?? []);
  const sources = [...(assignment_sources ?? [])]
    .sort((s1, s2) => s1.position - s2.position)
    .map(({ position: _position, ...s }) => s as StudentSource);

  // path + name are set together or both null (CHECK in 0049).
  const rubricFile: RubricFile | null = rubric_file_path
    ? {
        path: rubric_file_path,
        name: rubric_file_name ?? rubric_file_path,
        mime: rubric_file_mime ?? "",
      }
    : null;

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
    throw new Error(
      `getStudentAssignmentDetail writing: ${writingsError.message}`
    );
  }

  const w = (writings?.[0] ?? null) as RawWriting | null;

  return {
    ...flat,
    due_at: dueAt,
    sources,
    rubric_file: rubricFile,
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
