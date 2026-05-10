"use server";

/**
 * Mutations for teacher_feedback. RLS does the scoping (0002:785-822):
 *
 *  - teacher_feedback_teacher_insert — teachers (and admins) can INSERT
 *    on writings they can write; teacher_id must be auth.uid().
 *  - teacher_feedback_teacher_update — teachers can UPDATE only their
 *    own rows.
 *  - teacher_feedback_teacher_delete — teachers can DELETE only their
 *    own rows.
 *  - teacher_feedback_student_resolve — students can flip is_resolved
 *    on feedback for their own writings (and only that column).
 *
 * Validation here is defense-in-depth (RLS still rejects malformed
 * inserts; we just throw a friendlier error first).
 *
 * All mutations revalidate the writing's review path so the panel
 * picks up the change immediately.
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
 * Adds a whole-writing comment. target_kind='student_writing',
 * target_id=writingId. Rejected at the schema level if body is empty
 * (TEXT NOT NULL); we catch it earlier for a typed error.
 */
export async function addWritingFeedback(
  writingId: string,
  body: string
): Promise<void> {
  const profile = await requireRole(TEACHER_ROLES);
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error("Feedback body cannot be empty.");
  }

  const supabase = await createServerClient();

  // Look up the assignment id once for revalidation.
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();

  const { error } = await supabase.from("teacher_feedback").insert({
    student_writing_id: writingId,
    teacher_id: profile.id,
    target_kind: "student_writing",
    target_id: writingId,
    body: trimmed,
    is_resolved: false,
  });

  if (error) {
    throw new Error(`addWritingFeedback: ${error.message}`);
  }

  if (writing?.assignment_id) {
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
  revalidatePath("/student/assignments");
}

/**
 * Updates the body of an existing feedback row. RLS allows only the
 * authoring teacher.
 */
export async function editFeedback(
  feedbackId: string,
  body: string
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error("Feedback body cannot be empty.");
  }

  const supabase = await createServerClient();

  // Read writing_id for revalidation before update.
  const { data: existing } = await supabase
    .from("teacher_feedback")
    .select("student_writing_id")
    .eq("id", feedbackId)
    .maybeSingle();

  const { error } = await supabase
    .from("teacher_feedback")
    .update({ body: trimmed })
    .eq("id", feedbackId);

  if (error) {
    throw new Error(`editFeedback: ${error.message}`);
  }

  if (existing?.student_writing_id) {
    revalidatePath(`/dashboard`, "layout");
    revalidatePath(
      `/student/writings/${existing.student_writing_id}`,
      "layout"
    );
  }
}

/**
 * Deletes a feedback row. RLS allows only the authoring teacher.
 */
export async function deleteFeedback(feedbackId: string): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("teacher_feedback")
    .select("student_writing_id")
    .eq("id", feedbackId)
    .maybeSingle();

  const { error } = await supabase
    .from("teacher_feedback")
    .delete()
    .eq("id", feedbackId);

  if (error) {
    throw new Error(`deleteFeedback: ${error.message}`);
  }

  if (existing?.student_writing_id) {
    revalidatePath(`/dashboard`, "layout");
    revalidatePath(
      `/student/writings/${existing.student_writing_id}`,
      "layout"
    );
    revalidatePath("/student/assignments");
  }
}

/**
 * Student-facing: marks a feedback row as resolved on their own
 * writing. RLS policy teacher_feedback_student_resolve allows the
 * student to flip is_resolved on writings where they're the owner
 * (and constrains the WITH CHECK to that column only).
 *
 * The `student` role gate here is defense-in-depth — RLS already
 * rejects calls from teachers/admins via this code path because the
 * student-resolve policy gates on student_id = auth.uid().
 */
export async function markFeedbackResolved(feedbackId: string): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("teacher_feedback")
    .select("student_writing_id")
    .eq("id", feedbackId)
    .maybeSingle();

  const { error } = await supabase
    .from("teacher_feedback")
    .update({ is_resolved: true })
    .eq("id", feedbackId);

  if (error) {
    throw new Error(`markFeedbackResolved: ${error.message}`);
  }

  if (existing?.student_writing_id) {
    revalidatePath(
      `/student/writings/${existing.student_writing_id}`,
      "layout"
    );
    revalidatePath("/student/assignments");
  }
}
