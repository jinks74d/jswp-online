"use server";

/**
 * Mutations for the final-draft step.
 *
 * - bootstrapFinalDraft: idempotent. UNIQUE on student_writing_id +
 *   ignoreDuplicates upsert. Inserts with full_text='' (NOT NULL
 *   constraint) and title=null. Trigger sets word_count=1 on insert
 *   (regexp_split_to_array of empty string returns {''} → length 1);
 *   harmless because the UI uses client-side counts. Same quirk as
 *   chunk 4.6b's paragraph-form bootstrap.
 *
 * - updateTitle, updateFullText: focused setters.
 *
 * - assembleFinalDraft: server-side assembly. Reads essay_parts
 *   (introduction_text + conclusion_text) and paragraph_forms ordered
 *   by BP position, concatenates with double-newline separators,
 *   skips empty pieces, writes the result to full_text. Returns the
 *   assembled string for the UI to display immediately. Re-running
 *   is idempotent against fresh upstream data — students who go back
 *   and revise pieces can re-assemble to pick up the changes.
 *
 * RLS chains via student_writings.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function bootstrapFinalDraft(writingId: string): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("final_drafts")
    .upsert(
      { student_writing_id: writingId, full_text: "" },
      { onConflict: "student_writing_id", ignoreDuplicates: true }
    );
  if (error) {
    throw new Error(`bootstrapFinalDraft: ${error.message}`);
  }
}

export async function updateTitle(
  writingId: string,
  finalDraftId: string,
  title: string | null
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const trimmed = title?.trim() ?? "";
  const { error } = await supabase
    .from("final_drafts")
    .update({ title: trimmed.length > 0 ? trimmed : null })
    .eq("id", finalDraftId);
  if (error) {
    throw new Error(`updateTitle: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateFullText(
  writingId: string,
  finalDraftId: string,
  fullText: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("final_drafts")
    .update({ full_text: fullText })
    .eq("id", finalDraftId);
  if (error) {
    throw new Error(`updateFullText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Read fresh assembly source server-side and write the concat to
 * full_text. Empty pieces are skipped so the result doesn't have
 * stray double newlines from missing intro/conclusion/paragraphs.
 *
 * Returns the assembled string so the client can update its local
 * editor state without waiting for a full re-render.
 */
export async function assembleFinalDraft(
  writingId: string,
  finalDraftId: string
): Promise<string> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Fetch fresh assembly source.
  const { data: ep } = await supabase
    .from("essay_parts")
    .select("introduction_text, conclusion_text")
    .eq("student_writing_id", writingId)
    .maybeSingle();

  const { data: bps } = await supabase
    .from("body_paragraphs")
    .select(`position, paragraph_form:paragraph_forms ( final_text )`)
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  const intro = (ep?.introduction_text ?? "").trim();
  const conclusion = (ep?.conclusion_text ?? "").trim();

  const paragraphs = ((bps ?? []) as unknown as Array<{
    position: number;
    paragraph_form:
      | { final_text: string }
      | Array<{ final_text: string }>
      | null;
  }>)
    .map((bp) => {
      const pf = Array.isArray(bp.paragraph_form)
        ? (bp.paragraph_form[0] ?? null)
        : bp.paragraph_form;
      return (pf?.final_text ?? "").trim();
    })
    .filter((t) => t.length > 0);

  const pieces: string[] = [];
  if (intro.length > 0) pieces.push(intro);
  pieces.push(...paragraphs);
  if (conclusion.length > 0) pieces.push(conclusion);

  const assembled = pieces.join("\n\n");

  const { error } = await supabase
    .from("final_drafts")
    .update({ full_text: assembled })
    .eq("id", finalDraftId);
  if (error) {
    throw new Error(`assembleFinalDraft: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
  return assembled;
}
