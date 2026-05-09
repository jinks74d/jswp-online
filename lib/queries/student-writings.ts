/**
 * Server-side reads + the get-or-create handshake for a student's
 * writing on a given assignment. RLS scopes everything — the caller
 * sees only their own student_writings rows (per the
 * student_writings_student_select policy in 0002).
 *
 * Concurrency note: getOrCreateWriting handles the race where two
 * tabs hit [Start Writing] at the same moment by relying on the
 * UNIQUE (assignment_id, student_id, draft_number) constraint and
 * re-fetching on PG error 23505 (unique_violation). No SELECT FOR
 * UPDATE — Supabase doesn't expose locking and the constraint is
 * the source of truth.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { MODES, type JswpMode } from "@/lib/jswp-modes";

type WritingRow = Database["public"]["Tables"]["student_writings"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

export type WritingForStepEngine = WritingRow & {
  assignment: Pick<
    AssignmentRow,
    | "id"
    | "title"
    | "prompt"
    | "mode"
    | "is_essay"
    | "has_counterargument"
    | "source_text"
    | "source_title"
    | "source_author"
    | "default_chunk_ratio"
  >;
};

const PG_UNIQUE_VIOLATION = "23505";

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getWriting(
  writingId: string
): Promise<WritingForStepEngine | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("student_writings")
    .select(
      `
      *,
      assignment:assignment_id (
        id, title, prompt, mode, is_essay, has_counterargument,
        source_text, source_title, source_author, default_chunk_ratio
      )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (error) {
    console.error("getWriting:", error);
    return null;
  }
  if (!data) return null;

  // Supabase returns the embed as `assignment` — narrow the shape.
  const row = data as unknown as WritingForStepEngine;
  if (!row.assignment) return null;
  return row;
}

/**
 * Returns the set of completed step keys for a writing. Used by the
 * step sidebar (checkmark indicators) and the dispatcher's
 * reachability check.
 */
export async function getCompletedStepKeys(
  writingId: string
): Promise<Set<string>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("step_progress")
    .select("step_key, completed_at")
    .eq("student_writing_id", writingId)
    .not("completed_at", "is", null);

  if (error) {
    console.error("getCompletedStepKeys:", error);
    return new Set();
  }

  return new Set((data ?? []).map((r) => r.step_key));
}

/* ─── Get-or-create handshake ────────────────────────────────────────── */

interface GetOrCreateResult {
  writing: WritingRow;
  assignment: Pick<
    AssignmentRow,
    "id" | "mode" | "default_chunk_ratio" | "is_essay" | "has_counterargument" | "source_text"
  >;
  created: boolean;
}

export async function getOrCreateWriting(
  assignmentId: string,
  studentId: string
): Promise<GetOrCreateResult | null> {
  const supabase = await createServerClient();

  // 1. Fetch the assignment — RLS will reject if the student isn't
  // enrolled or the assignment isn't released.
  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select(
      "id, mode, default_chunk_ratio, is_essay, has_counterargument, source_text"
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (aErr) {
    console.error("getOrCreateWriting assignment lookup:", aErr);
    return null;
  }
  if (!assignment) return null;

  // 2. Look for an existing writing (latest draft).
  const { data: existing, error: eErr } = await supabase
    .from("student_writings")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("draft_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eErr) {
    console.error("getOrCreateWriting existing lookup:", eErr);
    return null;
  }

  if (existing) {
    return { writing: existing, assignment, created: false };
  }

  // 3. Create draft 1. Use the mode's first step as the starting point.
  const firstStepKey = MODES[assignment.mode as JswpMode].steps[0]?.key;

  const { data: inserted, error: iErr } = await supabase
    .from("student_writings")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      draft_number: 1,
      status: "draft",
      current_step: firstStepKey,
      chunk_ratio: assignment.default_chunk_ratio,
    })
    .select()
    .single();

  if (iErr) {
    // Race: another tab beat us to the insert. Re-fetch and return that row.
    if (iErr.code === PG_UNIQUE_VIOLATION) {
      const { data: raceExisting, error: rErr } = await supabase
        .from("student_writings")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId)
        .order("draft_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rErr || !raceExisting) {
        console.error("getOrCreateWriting race re-fetch:", rErr);
        return null;
      }
      return { writing: raceExisting, assignment, created: false };
    }

    console.error("getOrCreateWriting insert:", iErr);
    return null;
  }

  return { writing: inserted, assignment, created: true };
}
