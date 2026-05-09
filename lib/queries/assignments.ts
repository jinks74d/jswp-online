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
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

/* ─── Return types ───────────────────────────────────────────────────── */

export interface AssignmentListItem {
  id: string;
  title: string;
  mode: Mode;
  released_at: string | null;
  due_at: string | null;
  class_period_label: string | null;
  class_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentForEdit {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  is_essay: boolean;
  num_body_paragraphs: number;
  default_chunk_ratio: ChunkRatio;
  default_chunks_per_bp: number;
  has_counterargument: boolean;
  due_at: string | null;
  class_period_id: string | null;
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
  class_period: {
    period_label: string;
    class: { name: string } | null;
  } | null;
};

/* ─── Queries ────────────────────────────────────────────────────────── */

export function isPublished(a: { released_at: string | null }): boolean {
  return a.released_at !== null;
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
      class_period:class_period_id (
        period_label,
        class:class_id ( name )
      )
      `
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTeacherAssignments:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as AssignmentListRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    released_at: r.released_at,
    due_at: r.due_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    class_period_label: r.class_period?.period_label ?? null,
    class_name: r.class_period?.class?.name ?? null,
  }));
}

export async function getAssignmentForTeacher(
  assignmentId: string,
  teacherId: string
): Promise<AssignmentForEdit | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `id, title, prompt, mode, is_essay, num_body_paragraphs,
       default_chunk_ratio, default_chunks_per_bp, has_counterargument,
       due_at, class_period_id, released_at, created_at, updated_at`
    )
    .eq("id", assignmentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error) {
    console.error("getAssignmentForTeacher:", error);
    return null;
  }
  if (!data) return null;

  return data as AssignmentForEdit;
}

/**
 * Class period options scoped to the teacher's assignments. Used to
 * populate the class_period dropdown on the assignment form. Single
 * round-trip; no embedded subjects or schools (we just need a label).
 */
export async function getTeacherClassPeriodsForPicker(
  teacherId: string
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
        class:class_id (
          name,
          subject:subject_id ( name )
        ),
        school:school_id ( name )
      )
      `
    )
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("getTeacherClassPeriodsForPicker:", error);
    return [];
  }

  type Row = {
    class_period: {
      id: string;
      period_label: string;
      academic_year: string | null;
      class: {
        name: string;
        subject: { name: string } | null;
      } | null;
      school: { name: string } | null;
    } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  return rows
    .filter((r): r is Row & { class_period: NonNullable<Row["class_period"]> } =>
      r.class_period !== null
    )
    .map((r) => {
      const cp = r.class_period;
      const parts = [
        cp.school?.name,
        cp.class?.subject?.name,
        cp.class?.name,
        cp.period_label,
        cp.academic_year,
      ].filter(Boolean);
      return { id: cp.id, label: parts.join(" · ") };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
