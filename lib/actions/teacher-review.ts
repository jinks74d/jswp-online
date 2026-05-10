"use server";

/**
 * Status-transition mutations for teacher review (chunk 4.7b).
 *
 * RLS does the scoping: student_writings_teacher_update (0002:453-474)
 * lets the assigning teacher (or a teacher on the class period, or an
 * admin in scope) UPDATE any column. No CHECK on status — the caller
 * controls the legal transition.
 *
 * Both actions are idempotent against their target state: returning a
 * 'returned' writing is a no-op (status unchanged); grading a 'graded'
 * writing updates total_score / graded_at to the latest values.
 *
 * Concurrency: last-write-wins. Two teacher tabs both clicking
 * [Mark Graded] result in the second tab's score sticking.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const TEACHER_ROLES: ("teacher" | "school_admin" | "district_admin" | "super_admin")[] = [
  "teacher",
  "school_admin",
  "district_admin",
  "super_admin",
];

/**
 * Returns a writing for revision. Sets status='returned' and
 * returned_at=NOW(). Caller should ensure ≥1 unresolved feedback
 * row exists (UI gate); this action does NOT enforce that — RLS
 * doesn't either, so a programmatic caller could return a writing
 * with no feedback. The UI is the gate.
 */
export async function returnWriting(writingId: string): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();

  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();

  const { error } = await supabase
    .from("student_writings")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
    })
    .eq("id", writingId);

  if (error) {
    throw new Error(`returnWriting: ${error.message}`);
  }

  if (writing?.assignment_id) {
    revalidatePath(`/dashboard/assignments/${writing.assignment_id}`);
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings`
    );
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
  revalidatePath("/student/assignments");
}

/**
 * Marks a writing graded. Score is optional (NUMERIC(5,2) nullable
 * in schema; 4.7b's UI offers an optional input that may be blank).
 * Phase 5 will swap in rubric-based scoring.
 */
export async function gradeWriting(
  writingId: string,
  score: number | null
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();

  // Defense-in-depth on the score range. NUMERIC(5,2) supports up to
  // 999.99; constrain UI input to that range too.
  if (score !== null) {
    if (!Number.isFinite(score) || score < 0 || score > 999.99) {
      throw new Error("Score must be between 0 and 999.99.");
    }
  }

  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();

  const { error } = await supabase
    .from("student_writings")
    .update({
      status: "graded",
      graded_at: new Date().toISOString(),
      total_score: score,
    })
    .eq("id", writingId);

  if (error) {
    throw new Error(`gradeWriting: ${error.message}`);
  }

  if (writing?.assignment_id) {
    revalidatePath(`/dashboard/assignments/${writing.assignment_id}`);
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings`
    );
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
  revalidatePath("/student/assignments");
}
