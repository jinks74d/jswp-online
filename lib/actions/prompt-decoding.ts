"use server";

/**
 * Mutations for the Decode-the-Prompt step.
 *
 * Auto-save (savePromptDecoding) fires on each field's onBlur with the
 * full form payload — server upserts. Idempotent for unchanged values.
 *
 * Completion (completePromptDecoding) saves THEN marks the step done
 * THEN redirects forward. The auto-save path never marks complete —
 * a student who saves but doesn't click [Continue] is "in progress"
 * on the step, not done.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { markStepComplete } from "@/lib/actions/student-writings";
import { getSteps, getNextStep, type JswpMode } from "@/lib/jswp-modes";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

export interface PromptDecodingFields {
  task: string | null;
  form: string | null;
  ratio_identified: ChunkRatio | null;
  key_verbs: string[];
  focus_terms: string[];
  notes: string | null;
  // The guide's three-part prompt decomposition (2024 Expository guide
  // pp.135-139). cd_source = "where will I find my concrete details?".
  background_text: string | null;
  trigger_text: string | null;
  cd_source: string | null;
}

const VALID_FORMS = new Set(["short_answer", "paragraph", "essay"]);
const VALID_RATIOS = new Set<ChunkRatio>([
  "two_plus_to_one",
  "one_to_two_plus",
  "three_plus_to_zero",
]);

function sanitize(fields: PromptDecodingFields): PromptDecodingFields {
  return {
    task: fields.task?.trim() || null,
    form:
      fields.form && VALID_FORMS.has(fields.form) ? fields.form : null,
    ratio_identified:
      fields.ratio_identified && VALID_RATIOS.has(fields.ratio_identified)
        ? fields.ratio_identified
        : null,
    key_verbs: fields.key_verbs.map((v) => v.trim()).filter(Boolean),
    focus_terms: fields.focus_terms.map((v) => v.trim()).filter(Boolean),
    notes: fields.notes?.trim() || null,
    background_text: fields.background_text?.trim() || null,
    trigger_text: fields.trigger_text?.trim() || null,
    cd_source: fields.cd_source?.trim() || null,
  };
}

export async function savePromptDecoding(
  writingId: string,
  fields: PromptDecodingFields
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const clean = sanitize(fields);

  const { error } = await supabase.from("prompt_decodings").upsert(
    {
      student_writing_id: writingId,
      ...clean,
    },
    { onConflict: "student_writing_id" }
  );

  if (error) {
    console.error("savePromptDecoding:", error);
    throw new Error(`Could not save: ${error.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function completePromptDecoding(
  writingId: string,
  fields: PromptDecodingFields
): Promise<void> {
  // Soft client gate already requires `task`, but re-validate server-side.
  const trimmedTask = fields.task?.trim() ?? "";
  if (!trimmedTask) {
    throw new Error("Please describe what the prompt is asking before continuing.");
  }

  await savePromptDecoding(writingId, fields);

  // Resolve the writing's mode + assignment context for the step list.
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select(
      "chunk_ratio, assignment:assignment_id ( mode, is_essay, has_counterargument, source_text )"
    )
    .eq("id", writingId)
    .maybeSingle();

  const w = writing as unknown as {
    chunk_ratio: ChunkRatio;
    assignment: {
      mode: JswpMode;
      is_essay: boolean;
      has_counterargument: boolean;
      source_text: string | null;
    };
  } | null;
  const a = w?.assignment;

  if (!w || !a) {
    throw new Error("Could not resolve writing mode.");
  }

  const visible = getSteps(a.mode, {
    isEssay: a.is_essay,
    hasCounterargument: a.has_counterargument,
    hasSourceText: !!a.source_text,
    chunkRatio: w.chunk_ratio,
  });

  const decodeStep = visible.find((s) => s.groupOrigin === "decode_prompt");
  if (!decodeStep) {
    throw new Error(`No decode-prompt step in mode ${a.mode}`);
  }

  await markStepComplete(writingId, decodeStep.key);

  const next = getNextStep(decodeStep.key, visible);
  redirect(
    `/student/writings/${writingId}/${(next ?? decodeStep).slug}`
  );
}
