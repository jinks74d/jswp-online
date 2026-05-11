"use server";

/**
 * Rubric-based grading (chunk 5.1).
 *
 * gradeWritingByRubric replaces 4.7b's gradeWriting on assignments that have
 * a non-empty rubric. The action is atomic from the user's perspective:
 *
 *   1. Validate input (every criterion in range; no duplicates).
 *   2. Delete existing rubric_scores for the writing (re-grading replaces
 *      the prior snapshot in full).
 *   3. Insert new rows carrying snapshot fields.
 *   4. Update student_writings.status='graded', graded_at=NOW(),
 *      total_score=SUM(score).
 *
 * Steps 2–4 are not in a single transaction — Supabase's JS client doesn't
 * expose a multi-statement transaction. Failure between 2 and 3 leaves the
 * writing's rubric_scores empty; failure between 3 and 4 leaves it scored
 * but not marked graded. Both failure modes are recoverable by re-running
 * the grade. Acceptable trade-off vs. an RPC wrapper for v1.
 *
 * RLS gates the rubric_scores writes; the writing-update relies on the
 * existing student_writings_teacher_update policy (0002:453-474).
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const TEACHER_ROLES: (
  | "teacher"
  | "school_admin"
  | "district_admin"
  | "super_admin"
)[] = ["teacher", "school_admin", "district_admin", "super_admin"];

export interface RubricScoreInput {
  criterion_id: string;
  criterion_name: string;
  max_score: number;
  score: number;
  level_label: string | null;
}

export async function gradeWritingByRubric(
  writingId: string,
  scores: ReadonlyArray<RubricScoreInput>
): Promise<void> {
  await requireRole(TEACHER_ROLES);

  if (scores.length === 0) {
    throw new Error("At least one rubric criterion score is required.");
  }

  const seenCriteria = new Set<string>();
  let totalScore = 0;
  for (const s of scores) {
    if (seenCriteria.has(s.criterion_id)) {
      throw new Error(`Duplicate score for criterion ${s.criterion_name}.`);
    }
    seenCriteria.add(s.criterion_id);

    if (!Number.isFinite(s.score) || !Number.isFinite(s.max_score)) {
      throw new Error(`Score for ${s.criterion_name} must be a number.`);
    }
    if (s.max_score <= 0) {
      throw new Error(`Max score for ${s.criterion_name} must be positive.`);
    }
    if (s.score < 0 || s.score > s.max_score) {
      throw new Error(
        `Score for ${s.criterion_name} must be between 0 and ${s.max_score}.`
      );
    }
    totalScore += s.score;
  }

  // Round to NUMERIC(5,2) precision; clamp to schema's max (999.99).
  const rounded = Math.round(totalScore * 100) / 100;
  if (rounded > 999.99) {
    throw new Error("Total score exceeds the supported range (999.99).");
  }

  const supabase = await createServerClient();

  // Fetch assignment_id up front so we can revalidate even if the row goes
  // away mid-action. Also acts as an existence + visibility check (RLS
  // returns null if the caller can't see the writing).
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();

  if (!writing) {
    throw new Error("Writing not found or not visible to you.");
  }

  // Replace prior rubric_scores for this writing.
  const { error: delErr } = await supabase
    .from("rubric_scores")
    .delete()
    .eq("student_writing_id", writingId);
  if (delErr) {
    throw new Error(`gradeWritingByRubric delete: ${delErr.message}`);
  }

  const rows = scores.map((s) => ({
    student_writing_id: writingId,
    criterion_id: s.criterion_id,
    criterion_name: s.criterion_name,
    max_score: s.max_score,
    score: s.score,
    level_label: s.level_label,
  }));

  const { error: insErr } = await supabase.from("rubric_scores").insert(rows);
  if (insErr) {
    throw new Error(`gradeWritingByRubric insert: ${insErr.message}`);
  }

  const { error: updErr } = await supabase
    .from("student_writings")
    .update({
      status: "graded",
      graded_at: new Date().toISOString(),
      total_score: rounded,
    })
    .eq("id", writingId);
  if (updErr) {
    throw new Error(`gradeWritingByRubric update: ${updErr.message}`);
  }

  revalidatePath(`/dashboard/assignments/${writing.assignment_id}`);
  revalidatePath(`/dashboard/assignments/${writing.assignment_id}/writings`);
  revalidatePath(
    `/dashboard/assignments/${writing.assignment_id}/writings/${writingId}`
  );
  revalidatePath(`/student/writings/${writingId}`, "layout");
  revalidatePath("/student/assignments");
}
