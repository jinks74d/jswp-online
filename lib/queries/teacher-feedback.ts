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
    console.error("countTeacherFeedback:", error);
    return 0;
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
      body, rubric_score, is_resolved, created_at, updated_at,
      author:teacher_id ( id, first_name, last_name )
      `
    )
    .eq("student_writing_id", writingId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listFeedback:", error);
    return [];
  }
  return (data ?? []) as unknown as FeedbackItemRow[];
}

/**
 * Counts unresolved teacher_feedback for a batch of writings. Returns
 * a Map keyed by writing id. Used by /student/assignments to annotate
 * "Needs Revision" cards with their pending feedback count without
 * an N+1.
 */
export async function countTeacherFeedbackByWriting(
  writingIds: readonly string[]
): Promise<Map<string, number>> {
  if (writingIds.length === 0) return new Map();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teacher_feedback")
    .select("student_writing_id")
    .in("student_writing_id", writingIds)
    .eq("is_resolved", false);
  if (error) {
    console.error("countTeacherFeedbackByWriting:", error);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.student_writing_id, (counts.get(row.student_writing_id) ?? 0) + 1);
  }
  return counts;
}
