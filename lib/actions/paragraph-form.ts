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
import { requireRole, requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { composeParagraphText } from "@/lib/compose-paragraph";
import { getParagraphFormData } from "@/lib/queries/paragraph-form";

// CD/CM modes compose the Paragraph Form from tagged TS/CD/CM/CS
// sentences (lib/compose-paragraph). Narrative assembles differently
// and keeps its own final_text handling — auto-sync skips it.
const CD_CM_MODES = new Set(["expository", "argumentation", "literary"]);

export async function bootstrapParagraphForms(
  writingId: string
): Promise<void> {
  // Same step components render in the teacher's CombinedView review
  // surface. Bootstrap is a student-only side effect (creates rows so
  // the UI has something to bind to); teachers viewing read-only just
  // see whatever exists. Early-return for non-students rather than
  // redirecting to /forbidden.
  const profile = await requireUser();
  if (profile.role !== "student") return;
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

/**
 * Manual fine-tune edit of final_text. Flips final_text_customized to
 * true so the auto-sync (syncParagraphForms) stops regenerating it and
 * the student's wording is preserved. This is the ONLY path that sets
 * the flag — the auto-sync writes final_text without touching it.
 */
export async function updateFinalText(
  writingId: string,
  paragraphFormId: string,
  finalText: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("paragraph_forms")
    .update({ final_text: finalText, final_text_customized: true })
    .eq("id", paragraphFormId);
  if (error) {
    throw new Error(`updateFinalText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Re-adopt the live composed paragraph after the student had customized
 * final_text (the "use my latest sentences" nudge). Clears the customized
 * flag so future visits resume auto-syncing. composedText is the student's
 * own derived data, passed from the pane that already computed it.
 */
export async function resyncFinalTextToCompose(
  writingId: string,
  paragraphFormId: string,
  composedText: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("paragraph_forms")
    .update({ final_text: composedText, final_text_customized: false })
    .eq("id", paragraphFormId);
  if (error) {
    throw new Error(`resyncFinalTextToCompose: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Auto-sync final_text from the composed paragraph for every non-customized
 * Paragraph Form row. Idempotent; called from the step's RSC render after
 * bootstrap. Fixes the stale-seed bug: a student who edits Shaping Sheet
 * sentences after first visiting the Paragraph Form gets a final_text that
 * tracks those edits — unless they hand-edited (final_text_customized), in
 * which case their wording is left alone. CD/CM modes only; narrative
 * composes its paragraph differently and is left untouched.
 *
 * Returns paragraph_form id → the text it composed, for the caller to overlay
 * on its own read. That is not a convenience: this function reads through
 * getParagraphFormData, so the step's read afterwards is the second identical
 * GET of the render and Next.js serves it the pre-write response. Returning
 * the composition is what lets the render that FIRST fills final_text actually
 * show it. See lib/paragraph-form-sync.
 */
export async function syncParagraphForms(
  writingId: string
): Promise<ReadonlyMap<string, string>> {
  const profile = await requireUser();
  if (profile.role !== "student") return new Map();
  const supabase = await createServerClient();
  // Absence means "the stored value is already right" — see applySyncedFinalText.
  const synced = new Map<string, string>();

  const { data: writing } = await supabase
    .from("student_writings")
    .select("status, assignment:assignment_id ( mode, has_counterargument )")
    .eq("id", writingId)
    .maybeSingle();
  if (!writing) return synced;
  const w = writing as unknown as {
    status: "draft" | "in_progress" | "submitted" | "returned" | "graded";
    assignment: { mode: string; has_counterargument: boolean };
  };
  // Submitted/graded are frozen; RLS would reject the write anyway.
  if (w.status === "submitted" || w.status === "graded") return synced;
  if (!CD_CM_MODES.has(w.assignment.mode)) return synced;
  const hasCounterargument = w.assignment.has_counterargument;

  const bps = await getParagraphFormData(writingId);
  for (const bp of bps) {
    const pf = bp.paragraph_form;
    if (!pf || pf.final_text_customized) continue;

    // Compose identically to the pane (cd-cm-paragraph-form-bp-pane).
    const composed = composeParagraphText({
      topicSentence:
        bp.shaping?.final_topic_sentence?.trim() ||
        bp.working_topic_sentence?.trim() ||
        "",
      chunks: bp.chunks.map((c) => ({
        cd_sentences: c.cd_sentences,
        cm_sentences: c.cm_sentences,
      })),
      concession: hasCounterargument ? bp.shaping?.final_concession : null,
      counterargument: hasCounterargument
        ? bp.shaping?.final_counterargument
        : null,
      refutation: hasCounterargument ? bp.shaping?.final_refutation : null,
      concludingSentence:
        bp.shaping?.final_concluding_sentence?.trim() ||
        bp.concluding_sentence?.trim() ||
        "",
    });

    synced.set(pf.id, composed);

    if (composed !== pf.final_text) {
      const { error } = await supabase
        .from("paragraph_forms")
        .update({ final_text: composed })
        .eq("id", pf.id);
      if (error) {
        throw new Error(`syncParagraphForms update: ${error.message}`);
      }
    }
  }
  // No revalidatePath: this runs during the step's RSC render. The caller does
  // not re-read to observe the writes — it overlays the returned map, because
  // a re-read in this pass is memoized to the snapshot taken above.
  return synced;
}
