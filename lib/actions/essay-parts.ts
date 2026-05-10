"use server";

/**
 * Mutations for the essay-parts steps (thesis / introduction /
 * conclusion). Three steps share one row — one essay_parts per
 * student_writing — so each step writes a different subset of
 * columns via the same `update` shape.
 *
 * - bootstrapEssayParts: idempotent. UNIQUE on student_writing_id +
 *   ignoreDuplicates upsert. All fields default null. No
 *   revalidatePath (called from RSC render).
 * - updateThesisFields, updateIntroductionFields, updateConclusionText:
 *   focused setters. Each step's UI only touches its own columns.
 *
 * RLS chains via student_writings.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ThesisFrame = Database["public"]["Enums"]["jswp_thesis_frame"];

const VALID_THESIS_FRAMES = new Set<ThesisFrame>([
  "open",
  "framed_but",
  "framed_although",
  "three_pronged",
]);

const VALID_HOOK_KINDS = new Set<string>([
  "anecdote",
  "rhetorical_question",
  "startling_fact",
  "dialogue",
  "famous_quote",
  "internal_monologue",
]);

export async function bootstrapEssayParts(writingId: string): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("essay_parts")
    .upsert(
      { student_writing_id: writingId },
      { onConflict: "student_writing_id", ignoreDuplicates: true }
    );
  if (error) {
    throw new Error(`bootstrapEssayParts: ${error.message}`);
  }
}

export async function updateThesisFields(
  writingId: string,
  essayPartsId: string,
  fields: {
    thesis_text?: string | null;
    thesis_frame?: ThesisFrame | null;
  }
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Validate enum on the server side as defense-in-depth (the schema
  // CHECK on jswp_thesis_frame catches it too, but a typed error here
  // is friendlier than a Postgres rejection).
  if (
    fields.thesis_frame !== undefined &&
    fields.thesis_frame !== null &&
    !VALID_THESIS_FRAMES.has(fields.thesis_frame)
  ) {
    throw new Error(`Invalid thesis_frame: ${fields.thesis_frame}`);
  }

  const { error } = await supabase
    .from("essay_parts")
    .update(fields)
    .eq("id", essayPartsId);
  if (error) {
    throw new Error(`updateThesisFields: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateIntroductionFields(
  writingId: string,
  essayPartsId: string,
  fields: {
    introduction_text?: string | null;
    introduction_hook_kind?: string | null;
  }
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // No DB CHECK on introduction_hook_kind (just a documented VARCHAR(50)
  // per schema comment), so validate the convention here.
  if (
    fields.introduction_hook_kind !== undefined &&
    fields.introduction_hook_kind !== null &&
    !VALID_HOOK_KINDS.has(fields.introduction_hook_kind)
  ) {
    throw new Error(
      `Invalid introduction_hook_kind: ${fields.introduction_hook_kind}`
    );
  }

  const { error } = await supabase
    .from("essay_parts")
    .update(fields)
    .eq("id", essayPartsId);
  if (error) {
    throw new Error(`updateIntroductionFields: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateConclusionText(
  writingId: string,
  essayPartsId: string,
  conclusionText: string | null
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("essay_parts")
    .update({ conclusion_text: conclusionText })
    .eq("id", essayPartsId);
  if (error) {
    throw new Error(`updateConclusionText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
