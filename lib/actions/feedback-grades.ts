"use server";

/**
 * Feedback-area grade mutations (migration 0031). Independent of the formal
 * rubric/total_score grading. RLS scopes writes (teacher can update writings
 * they grade and write teacher_feedback on them).
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { isValidGrade, type GradeFormat } from "@/lib/grade-format";

const TEACHER_ROLES: ("teacher" | "school_admin" | "district_admin" | "super_admin")[] = [
  "teacher",
  "school_admin",
  "district_admin",
  "super_admin",
];

async function revalidateFor(
  writingId: string,
  assignmentId: string | null
): Promise<void> {
  if (assignmentId) {
    revalidatePath(
      `/dashboard/assignments/${assignmentId}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function setGradeFormat(
  writingId: string,
  format: GradeFormat
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();
  const { error } = await supabase
    .from("student_writings")
    .update({ grade_format: format })
    .eq("id", writingId);
  if (error) throw new Error(`setGradeFormat: ${error.message}`);
  await revalidateFor(writingId, writing?.assignment_id ?? null);
}

export async function setOverallGrade(
  writingId: string,
  value: string
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id, grade_format")
    .eq("id", writingId)
    .maybeSingle();
  if (!writing) throw new Error("setOverallGrade: writing not found");
  const trimmed = value.trim();
  if (trimmed && !isValidGrade(writing.grade_format, trimmed)) {
    throw new Error("Invalid grade for this format.");
  }
  const { error } = await supabase
    .from("student_writings")
    .update({ overall_grade: trimmed.length > 0 ? trimmed : null })
    .eq("id", writingId);
  if (error) throw new Error(`setOverallGrade: ${error.message}`);
  await revalidateFor(writingId, writing.assignment_id);
}

export async function setSectionGrade(
  writingId: string,
  stepKey: string,
  value: string
): Promise<void> {
  const profile = await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id, grade_format")
    .eq("id", writingId)
    .maybeSingle();
  if (!writing) throw new Error("setSectionGrade: writing not found");
  const trimmed = value.trim();
  if (trimmed && !isValidGrade(writing.grade_format, trimmed)) {
    throw new Error("Invalid grade for this format.");
  }

  const { data: existing } = await supabase
    .from("teacher_feedback")
    .select("id, body")
    .eq("student_writing_id", writingId)
    .eq("teacher_id", profile.id)
    .eq("step_key", stepKey)
    .maybeSingle();

  if (trimmed.length === 0) {
    if (existing) {
      const bodyEmpty = (existing.body ?? "").trim().length === 0;
      const { error } = bodyEmpty
        ? await supabase.from("teacher_feedback").delete().eq("id", existing.id)
        : await supabase
            .from("teacher_feedback")
            .update({ grade_value: null })
            .eq("id", existing.id);
      if (error) throw new Error(`setSectionGrade clear: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("teacher_feedback").upsert(
      {
        student_writing_id: writingId,
        teacher_id: profile.id,
        target_kind: "student_writing",
        target_id: writingId,
        step_key: stepKey,
        body: existing?.body ?? "",
        grade_value: trimmed,
        is_resolved: false,
      },
      { onConflict: "student_writing_id,teacher_id,step_key" }
    );
    if (error) throw new Error(`setSectionGrade set: ${error.message}`);
  }
  await revalidateFor(writingId, writing.assignment_id);
}
