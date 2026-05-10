/**
 * Read-only queries for teacher_feedback. RLS scopes everything:
 * the caller sees only feedback on writings they can read (per the
 * teacher_feedback_read policy in 0002 — gated by
 * auth_user_can_read_writing).
 *
 * 4.7a only needs unresolved-count for the returned-state banner +
 * the assignments list "feedback waiting" annotation. 4.7b will
 * extend this file with listFeedback and friends.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";

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
