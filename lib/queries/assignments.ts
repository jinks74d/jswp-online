/**
 * Read-only queries for the teacher assignment views. RLS-scoped via
 * the teacher's session — getTeacherAssignments returns only rows
 * where teacher_id = auth.uid() (per the assignments_teacher_own
 * policy in migrations/0002_rls_policies.sql).
 *
 * "Status" is derived: released_at IS NULL → draft, else published.
 * The schema has no `status` column.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";
import type { RubricFile } from "@/lib/rubric-file";
import { distinctDueDates, earliestDueAt } from "@/lib/assignment-due-dates";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

// Structurally identical to SourceTextFields' SourceInitial. Defined here to
// keep this server-only query decoupled from the "use client" component.
type SourceInitial = {
  /** Row id — identifies an ALREADY-PERSISTED source. New rows post null, and
   *  that is what lets the published path tell "append this" from "edit that". */
  id: string;
  kind: "primary" | "secondary";
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  source_html: string | null;
  source_render_mode: "pdf" | "rich" | "plain" | "image" | null;
  source_file_path: string | null;
  source_file_name: string | null;
  source_file_mime: string | null;
};

/* ─── Return types ───────────────────────────────────────────────────── */

/** One class period an assignment is assigned to, with that class's deadline. */
export interface AssignmentPeriodSummary {
  class_period_id: string;
  period_label: string | null;
  class_name: string | null;
  /** That period's override; null inherits the assignment default. */
  due_at: string | null;
}

export interface AssignmentListItem {
  id: string;
  title: string;
  mode: Mode;
  released_at: string | null;
  /** Earliest deadline across every period — see lib/assignment-due-dates.ts. */
  due_at: string | null;
  /**
   * How many DISTINCT deadlines this assignment's classes have. 1 means they
   * all agree and `due_at` is the whole story; greater than 1 means `due_at`
   * is only the earliest, and the list view says so ("Mar 3 +2 more") rather
   * than presenting one class's date as the date. 0 for an unassigned draft.
   */
  due_date_count: number;
  /** Every class this assignment reaches. Empty for an unassigned draft. */
  class_periods: AssignmentPeriodSummary[];
  created_at: string;
  updated_at: string;
  /** Number of student_writings rows — drives delete/unpublish warnings. */
  student_writing_count: number;
}

export interface AssignmentForEdit {
  id: string;
  /** The school that owns this assignment; bounds which classes it can reach. */
  school_id: string;
  title: string;
  prompt: string;
  mode: Mode;
  is_essay: boolean;
  num_body_paragraphs: number;
  default_chunk_ratio: ChunkRatio;
  default_chunks_per_bp: number;
  has_counterargument: boolean;
  sources: SourceInitial[];
  rubric: Json | null;
  /** Attached rubric document, folded from the three rubric_file_* columns. */
  rubric_file: RubricFile | null;
  /** The assignment-level default deadline; periods may override it. */
  due_at: string | null;
  /** Every class this assignment is assigned to, with per-class deadlines. */
  class_periods: AssignmentPeriodSummary[];
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassPeriodOption {
  id: string;
  label: string;
}

/* ─── Internal raw-row shapes ────────────────────────────────────────── */

type AssignmentListRow = {
  id: string;
  title: string;
  mode: Mode;
  released_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  assignment_class_periods: {
    class_period_id: string;
    due_at: string | null;
    class_period: {
      period_label: string;
      class: { name: string } | null;
    } | null;
  }[];
  student_writings: { count: number }[];
};

/* ─── Queries ────────────────────────────────────────────────────────── */

export function isPublished(a: { released_at: string | null }): boolean {
  return a.released_at !== null;
}

/**
 * Human label for the classes an assignment reaches, e.g.
 * "US History · Period 1" or "US History · Period 1 +2 more".
 *
 * Truncated rather than wrapped: an assignment can go to a whole day's
 * timetable, and a list cell that grows to six lines makes the table unusable.
 * The assignment detail page shows the full set.
 */
export function formatAssignmentClasses(
  periods: readonly AssignmentPeriodSummary[],
  maxShown = 1
): string {
  if (periods.length === 0) return "Not assigned to a class";

  const label = (p: AssignmentPeriodSummary) =>
    [p.class_name, p.period_label].filter(Boolean).join(" · ") || "Untitled class";

  const shown = periods.slice(0, maxShown).map(label).join("; ");
  const rest = periods.length - maxShown;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

export async function getTeacherAssignments(
  teacherId: string
): Promise<AssignmentListItem[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id, title, mode, released_at, due_at, created_at, updated_at,
      assignment_class_periods (
        class_period_id,
        due_at,
        class_period:class_period_id (
          period_label,
          class:class_id ( name )
        )
      ),
      student_writings ( count )
      `
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getTeacherAssignments: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as AssignmentListRow[];

  return rows.map((r) => {
    const periods = r.assignment_class_periods ?? [];
    return {
      id: r.id,
      title: r.title,
      mode: r.mode,
      released_at: r.released_at,
      // The list shows one row per assignment however many classes it reaches,
      // so lead with the first deadline any student is held to and flag when
      // the classes disagree rather than picking one arbitrarily.
      due_at: earliestDueAt(r.due_at, periods),
      due_date_count: distinctDueDates(r.due_at, periods).length,
      created_at: r.created_at,
      updated_at: r.updated_at,
      class_periods: periods.map((p) => ({
        class_period_id: p.class_period_id,
        period_label: p.class_period?.period_label ?? null,
        class_name: p.class_period?.class?.name ?? null,
        due_at: p.due_at,
      })),
      student_writing_count: r.student_writings?.[0]?.count ?? 0,
    };
  });
}

export async function getAssignmentForTeacher(
  assignmentId: string,
  teacherId: string
): Promise<AssignmentForEdit | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, school_id, title, prompt, mode, is_essay, num_body_paragraphs,
       default_chunk_ratio, default_chunks_per_bp, has_counterargument,
       rubric, rubric_file_path, rubric_file_name, rubric_file_mime,
       due_at, released_at, created_at, updated_at,
       assignment_class_periods (
         class_period_id,
         due_at,
         class_period:class_period_id (
           period_label,
           class:class_id ( name )
         )
       ),
       assignment_sources (
         id, position, kind,
         source_text, source_title, source_author, source_citation, source_url,
         source_html, source_render_mode, source_file_path, source_file_name,
         source_file_mime
       )`
    )
    .eq("id", assignmentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error) {
    throw new Error(`getAssignmentForTeacher: ${error.message}`);
  }
  if (!data) return null;

  const {
    assignment_sources,
    assignment_class_periods,
    rubric_file_path,
    rubric_file_name,
    rubric_file_mime,
    ...rest
  } = data as unknown as Omit<
    AssignmentForEdit,
    "sources" | "rubric_file" | "class_periods"
  > & {
    assignment_sources: (SourceInitial & { position: number })[];
    assignment_class_periods: {
      class_period_id: string;
      due_at: string | null;
      class_period: {
        period_label: string;
        class: { name: string } | null;
      } | null;
    }[];
    rubric_file_path: string | null;
    rubric_file_name: string | null;
    rubric_file_mime: string | null;
  };

  const class_periods: AssignmentPeriodSummary[] = (
    assignment_class_periods ?? []
  ).map((p) => ({
    class_period_id: p.class_period_id,
    period_label: p.class_period?.period_label ?? null,
    class_name: p.class_period?.class?.name ?? null,
    due_at: p.due_at,
  }));

  const sources = [...(assignment_sources ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...s }) => s as SourceInitial);

  // path + name are set together or both null (CHECK in 0049), so testing
  // path alone is enough to know whether a document is attached.
  const rubric_file: RubricFile | null = rubric_file_path
    ? {
        path: rubric_file_path,
        name: rubric_file_name ?? rubric_file_path,
        mime: rubric_file_mime ?? "",
      }
    : null;

  return {
    ...rest,
    sources,
    class_periods,
    rubric_file,
  } as AssignmentForEdit;
}

/**
 * Count of student_writings rows attached to an assignment. Used by the
 * mutations chunk to decide whether delete/unpublish are allowed —
 * non-zero count blocks both. RLS-scoped: a teacher who can't read
 * the writings will get 0, which is the safe answer (the action's own
 * gate also re-checks ownership).
 */
export async function getStudentWritingCount(
  assignmentId: string
): Promise<number> {
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("student_writings")
    .select("*", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);
  return count ?? 0;
}

/**
 * Class period options for the assignment form's class picker: the periods
 * this teacher teaches AT `schoolId`. Single round-trip.
 *
 * Scoped to one school because schools are independent — an assignment
 * belongs to a school and may only be handed to classes there. Pass the
 * ASSIGNMENT's school when editing (a teacher who transferred is still
 * editing a row owned by the old school) and the teacher's own when creating.
 */
export async function getTeacherClassPeriodsForPicker(
  teacherId: string,
  schoolId: string
): Promise<ClassPeriodOption[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select(
      `
      class_period:class_period_id (
        id,
        period_label,
        academic_year,
        school_id,
        class:class_id (
          name,
          subject:subject_id ( name )
        )
      )
      `
    )
    .eq("teacher_id", teacherId);

  if (error) {
    throw new Error(`getTeacherClassPeriodsForPicker: ${error.message}`);
  }

  type Row = {
    class_period: {
      id: string;
      period_label: string;
      academic_year: string | null;
      school_id: string;
      class: {
        name: string;
        subject: { name: string } | null;
      } | null;
    } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  return rows
    .filter((r): r is Row & { class_period: NonNullable<Row["class_period"]> } =>
      // Schools are independent, so an assignment may only reach classes at
      // its own school. A teacher who works at two schools holds periods at
      // both; offering the other school's periods here would produce a
      // selection the 0051 write policy then rejects mid-save.
      r.class_period !== null && r.class_period.school_id === schoolId
    )
    .map((r) => {
      const cp = r.class_period;
      // No school name in the label — every option is at `schoolId` now, so
      // the prefix would repeat on every row without distinguishing anything.
      const parts = [
        cp.class?.subject?.name,
        cp.class?.name,
        cp.period_label,
        cp.academic_year,
      ].filter(Boolean);
      return { id: cp.id, label: parts.join(" · ") };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
