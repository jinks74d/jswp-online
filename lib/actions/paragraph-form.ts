"use server";

/**
 * Mutations for the paragraph_form step.
 *
 * - bootstrapParagraphForms: idempotent. One paragraph_forms row
 *   per body_paragraph (UNIQUE on body_paragraph_id, race-safe via
 *   ignoreDuplicates upsert). Inserts with final_text='' so the
 *   row exists before the student starts typing.
 * - updateFinalText: writes paragraph_forms.final_text. Word count
 *   recomputed by the trigger.
 *
 * RLS chains via body_paragraphs → student_writings.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function bootstrapParagraphForms(
  writingId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Read-only states: skip bootstrap. RLS would reject the upserts.
  const { data: writing } = await supabase
    .from("student_writings")
    .select("status")
    .eq("id", writingId)
    .maybeSingle();
  if (
    writing &&
    (writing.status === "submitted" || writing.status === "graded")
  ) {
    return;
  }

  // Fetch BPs for this writing.
  const { data: bps, error: bpErr } = await supabase
    .from("body_paragraphs")
    .select("id")
    .eq("student_writing_id", writingId);
  if (bpErr) {
    throw new Error(`bootstrapParagraphForms BPs fetch: ${bpErr.message}`);
  }
  if (!bps || bps.length === 0) return;

  const rows = bps.map((bp) => ({
    body_paragraph_id: bp.id,
    final_text: "",
  }));

  const { error } = await supabase
    .from("paragraph_forms")
    .upsert(rows, {
      onConflict: "body_paragraph_id",
      ignoreDuplicates: true,
    });
  if (error) {
    throw new Error(`bootstrapParagraphForms upsert: ${error.message}`);
  }
  // No revalidatePath: this runs in RSC render. See chunk 4.5b1's
  // bootstrap pattern.
}

export async function updateFinalText(
  writingId: string,
  paragraphFormId: string,
  finalText: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("paragraph_forms")
    .update({ final_text: finalText })
    .eq("id", paragraphFormId);
  if (error) {
    throw new Error(`updateFinalText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
