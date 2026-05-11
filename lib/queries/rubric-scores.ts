/**
 * Per-writing rubric-score reads (chunk 5.1).
 *
 * RLS-scoped via auth_user_can_read_writing — students see only their own
 * breakdowns; teachers/admins see writings on assignments they teach.
 *
 * The returned rows carry snapshot fields (criterion_name, max_score,
 * level_label) so display works even if assignment.rubric was edited
 * after the grade was entered. Ordered by criterion_name for stable UI.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { RubricScores } from "@/lib/database.types";

export type RubricScoreRow = Pick<
  RubricScores,
  | "id"
  | "criterion_id"
  | "criterion_name"
  | "max_score"
  | "score"
  | "level_label"
  | "comment"
>;

export async function getRubricScoresForWriting(
  writingId: string
): Promise<RubricScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("rubric_scores")
    .select(
      "id, criterion_id, criterion_name, max_score, score, level_label, comment"
    )
    .eq("student_writing_id", writingId)
    .order("criterion_name", { ascending: true });

  if (error) {
    console.error("getRubricScoresForWriting:", error);
    return [];
  }
  return (data ?? []) as RubricScoreRow[];
}
