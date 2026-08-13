/**
 * Read-only queries for teacher_feedback. RLS scopes everything:
 * the caller sees only feedback on writings they can read (per the
 * teacher_feedback_read policy in 0002 — gated by
 * auth_user_can_read_writing).
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type FeedbackTarget = Database["public"]["Enums"]["jswp_feedback_target"];

export interface FeedbackItemRow {
  id: string;
  student_writing_id: string;
  teacher_id: string;
  target_kind: FeedbackTarget;
  target_id: string;
  body: string;
  step_key: string | null;
  grade_value: string | null;
  rubric_score: number | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

/**
 * Counts unresolved teacher_feedback rows on a single writing.
 * Whole-writing comments (target_kind='student_writing') are the
 * only kind 4.7b creates; the count covers all kinds for forward
 * compatibility.
 */
export async function countTeacherFeedback(writingId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("teacher_feedback")
    .select("*", { count: "exact", head: true })
    .eq("student_writing_id", writingId)
    .eq("is_resolved", false);
  if (error) {
    throw new Error(`countTeacherFeedback: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Lists every teacher_feedback row on a writing, joined with the
 * author's user_profiles snippet for display. Ordered by created_at
 * desc (newest first — matches the panel's conversational UX).
 *
 * For 4.7b, only target_kind='student_writing' is created by the UI.
 * The query returns all rows regardless of target_kind so a future
 * inline-anchored extension surfaces older comments correctly.
 */
export async function listFeedback(
  writingId: string
): Promise<FeedbackItemRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teacher_feedback")
    .select(
      `
      id, student_writing_id, teacher_id, target_kind, target_id,
      step_key, grade_value, body, rubric_score, is_resolved, created_at, updated_at,
      author:teacher_id ( id, first_name, last_name )
      `
    )
    .eq("student_writing_id", writingId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`listFeedback: ${error.message}`);
  }
  return (data ?? []) as unknown as FeedbackItemRow[];
}

export interface FeedbackSummary {
  /** Every note the teacher left — section notes and overall comments alike. */
  readonly total: number;
  /** Of those, the ones the student hasn't marked resolved. */
  readonly unresolved: number;
}

/**
 * Feedback tallies per writing, for the student's assignment cards.
 *
 * Supersedes counting only unresolved rows: "unresolved" is the right measure
 * for a returned writing the student still has to act on, but on a GRADED one
 * it reads as zero the moment they tick things off, which made the card claim
 * there was no feedback at all. A student needs to know their teacher wrote
 * something whether or not there is anything left to do about it.
 *
 * Callers must still decide WHEN to show it. RLS lets the owning student read
 * feedback on their writing at any status, so the app layer is what keeps
 * half-written notes hidden while a teacher is mid-review — see the status gate
 * in components/student/assignment-card.tsx.
 */
export async function getFeedbackSummaryByWriting(
  writingIds: readonly string[]
): Promise<Map<string, FeedbackSummary>> {
  if (writingIds.length === 0) return new Map();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("teacher_feedback")
    .select("student_writing_id, is_resolved")
    .in("student_writing_id", writingIds);
  if (error) {
    throw new Error(`getFeedbackSummaryByWriting: ${error.message}`);
  }

  const map = new Map<string, FeedbackSummary>();
  for (const row of data ?? []) {
    const prev = map.get(row.student_writing_id) ?? { total: 0, unresolved: 0 };
    map.set(row.student_writing_id, {
      total: prev.total + 1,
      unresolved: prev.unresolved + (row.is_resolved ? 0 : 1),
    });
  }
  return map;
}
