/**
 * Server actions for assignment authoring. All actions enforce
 * teacher-only access at the layer (admins reviewing the teacher
 * dashboard can navigate but not create). district_id, school_id,
 * teacher_id are derived from the calling profile — never accepted
 * from the form.
 *
 * "Published" is encoded by released_at being non-null. There is no
 * status column.
 */

"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { validateRubric, emptyRubric } from "@/lib/rubric";
import type { Database, Json } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

const VALID_MODES = new Set<Mode>([
  "expository",
  "argumentation",
  "literary",
  "narrative",
]);
const VALID_RATIOS = new Set<ChunkRatio>([
  "two_plus_to_one",
  "one_to_two_plus",
  "three_plus_to_zero",
]);

export type AssignmentFormState = {
  error?: string;
  fieldErrors?: {
    title?: string;
    prompt?: string;
    num_body_paragraphs?: string;
    default_chunks_per_bp?: string;
    rubric?: string;
  };
  success?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function parseTimestamp(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyToNull(s: string): string | null {
  const v = s.trim();
  return v === "" ? null : v;
}

function parseCommonFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const isEssay =
    formData.get("is_essay") === "on" || formData.get("is_essay") === "true";
  const numBodyParagraphsRaw = formData.get("num_body_paragraphs");
  const numBodyParagraphs = numBodyParagraphsRaw
    ? Number(numBodyParagraphsRaw)
    : 1;
  const defaultChunksPerBpRaw = formData.get("default_chunks_per_bp");
  const defaultChunksPerBp = defaultChunksPerBpRaw
    ? Number(defaultChunksPerBpRaw)
    : 1;
  const chunkRatioRaw = String(
    formData.get("default_chunk_ratio") ?? "two_plus_to_one"
  );
  const hasCounterargument =
    formData.get("has_counterargument") === "on" ||
    formData.get("has_counterargument") === "true";
  const dueAt = parseTimestamp(String(formData.get("due_at") ?? ""));
  const classPeriodIdRaw = String(formData.get("class_period_id") ?? "");
  const classPeriodId = classPeriodIdRaw === "" ? null : classPeriodIdRaw;

  // Source text fields — Narrative mode form omits them entirely; the
  // action coerces missing/empty values to null. Explicit empty-to-null
  // conversion so accidental whitespace doesn't pollute the column.
  const sourceText = emptyToNull(String(formData.get("source_text") ?? ""));
  const sourceTitle = emptyToNull(String(formData.get("source_title") ?? ""));
  const sourceAuthor = emptyToNull(String(formData.get("source_author") ?? ""));
  const sourceCitation = emptyToNull(
    String(formData.get("source_citation") ?? "")
  );
  const sourceUrl = emptyToNull(String(formData.get("source_url") ?? ""));

  return {
    title,
    prompt,
    isEssay,
    numBodyParagraphs,
    defaultChunksPerBp,
    chunkRatioRaw,
    hasCounterargument,
    dueAt,
    classPeriodId,
    sourceText,
    sourceTitle,
    sourceAuthor,
    sourceCitation,
    sourceUrl,
  };
}

/**
 * Parse the rubric hidden input. Always returns a Rubric — never null —
 * matching the "treat null and { criteria: [] } identically" rule. On
 * shape failure returns a validation error in form-state shape.
 */
function parseAndValidateRubric(formData: FormData): {
  ok: true;
  rubric: ReturnType<typeof emptyRubric>;
} | {
  ok: false;
  state: AssignmentFormState;
} {
  const raw = formData.get("rubric");
  if (raw == null || raw === "") {
    return { ok: true, rubric: emptyRubric() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { ok: false, state: { fieldErrors: { rubric: "Rubric is malformed JSON." } } };
  }
  const result = validateRubric(parsed);
  if (!result.ok) {
    return { ok: false, state: { fieldErrors: { rubric: result.error } } };
  }
  return { ok: true, rubric: result.value };
}

function validateCommon(
  f: ReturnType<typeof parseCommonFields>,
  mode: Mode
):
  | { ok: true; chunkRatio: ChunkRatio; hasCounterargument: boolean }
  | { ok: false; state: AssignmentFormState } {
  if (!f.title) {
    return { ok: false, state: { fieldErrors: { title: "Title is required." } } };
  }
  if (f.title.length > 255) {
    return {
      ok: false,
      state: { fieldErrors: { title: "Title must be 255 characters or fewer." } },
    };
  }
  if (!f.prompt) {
    return {
      ok: false,
      state: { fieldErrors: { prompt: "Prompt is required." } },
    };
  }
  if (f.prompt.length > 5000) {
    return {
      ok: false,
      state: {
        fieldErrors: { prompt: "Prompt must be 5000 characters or fewer." },
      },
    };
  }

  // Mode-specific chunk ratio enforcement (CHECK constraint at
  // migration 0001 line 238-241 rejects literary with anything else).
  let chunkRatio: ChunkRatio;
  if (mode === "literary") {
    chunkRatio = "one_to_two_plus";
  } else {
    if (!VALID_RATIOS.has(f.chunkRatioRaw as ChunkRatio)) {
      return { ok: false, state: { error: "Invalid chunk ratio." } };
    }
    chunkRatio = f.chunkRatioRaw as ChunkRatio;
  }

  // Argumentation-only flag — silently coerce to false for other modes.
  const hasCounterargument =
    mode === "argumentation" ? f.hasCounterargument : false;

  // is_essay implies multi-body-paragraph; schema CHECK is 1-10.
  if (f.isEssay && f.numBodyParagraphs < 2) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          num_body_paragraphs:
            "Essays need at least 2 body paragraphs.",
        },
      },
    };
  }
  if (f.numBodyParagraphs < 1 || f.numBodyParagraphs > 10) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          num_body_paragraphs:
            "Body paragraphs must be between 1 and 10.",
        },
      },
    };
  }
  if (f.defaultChunksPerBp < 1 || f.defaultChunksPerBp > 5) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          default_chunks_per_bp: "Chunks per body paragraph must be 1-5.",
        },
      },
    };
  }

  return { ok: true, chunkRatio, hasCounterargument };
}

/* ─── Create draft ───────────────────────────────────────────────────── */

export async function createDraftAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const modeRaw = String(formData.get("mode") ?? "");
  if (!VALID_MODES.has(modeRaw as Mode)) {
    return { error: "Invalid mode." };
  }
  const mode = modeRaw as Mode;

  const f = parseCommonFields(formData);
  const v = validateCommon(f, mode);
  if (!v.ok) return v.state;

  const r = parseAndValidateRubric(formData);
  if (!r.ok) return r.state;

  // Narrative mode has no source text — coerce all source_* to null
  // even if the form somehow sent values (defense in depth).
  const isNarrative = mode === "narrative";

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: profile.id,
      district_id: profile.district_id,
      school_id: profile.school_id!,
      title: f.title,
      prompt: f.prompt,
      mode,
      is_essay: f.isEssay,
      num_body_paragraphs: f.isEssay ? f.numBodyParagraphs : 1,
      default_chunk_ratio: v.chunkRatio,
      default_chunks_per_bp: f.isEssay ? f.defaultChunksPerBp : 1,
      has_counterargument: v.hasCounterargument,
      source_text: isNarrative ? null : f.sourceText,
      source_title: isNarrative ? null : f.sourceTitle,
      source_author: isNarrative ? null : f.sourceAuthor,
      source_citation: isNarrative ? null : f.sourceCitation,
      source_url: isNarrative ? null : f.sourceUrl,
      rubric: r.rubric as unknown as Json,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create assignment." };
  }

  redirect(`/dashboard/assignments/${data.id}`);
}

/* ─── Update (draft or published) ────────────────────────────────────── */

export async function updateDraftAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at, mode")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };

  const f = parseCommonFields(formData);
  const isPublished = existing.released_at !== null;

  if (!f.title) {
    return { fieldErrors: { title: "Title is required." } };
  }
  if (!f.prompt) {
    return { fieldErrors: { prompt: "Prompt is required." } };
  }

  let update: Record<string, unknown>;
  if (isPublished) {
    // Locked after publish: mode, is_essay, num_body_paragraphs,
    // default_chunks_per_bp, default_chunk_ratio, has_counterargument,
    // source_text, source_title, source_author, source_citation,
    // source_url, rubric. Only title/prompt/due_at/class_period_id stay
    // editable.
    update = {
      title: f.title,
      prompt: f.prompt,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    };
  } else {
    const v = validateCommon(f, existing.mode);
    if (!v.ok) return v.state;

    const r = parseAndValidateRubric(formData);
    if (!r.ok) return r.state;

    const isNarrative = existing.mode === "narrative";

    update = {
      title: f.title,
      prompt: f.prompt,
      is_essay: f.isEssay,
      num_body_paragraphs: f.isEssay ? f.numBodyParagraphs : 1,
      default_chunk_ratio: v.chunkRatio,
      default_chunks_per_bp: f.isEssay ? f.defaultChunksPerBp : 1,
      has_counterargument: v.hasCounterargument,
      source_text: isNarrative ? null : f.sourceText,
      source_title: isNarrative ? null : f.sourceTitle,
      source_author: isNarrative ? null : f.sourceAuthor,
      source_citation: isNarrative ? null : f.sourceCitation,
      source_url: isNarrative ? null : f.sourceUrl,
      rubric: r.rubric as unknown as Json,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    };
  }

  const { error } = await supabase
    .from("assignments")
    .update(update)
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { success: "Saved." };
}

/* ─── Publish ────────────────────────────────────────────────────────── */

export async function publishAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at, title, prompt, class_period_id")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };
  if (existing.released_at) return { error: "Already published." };
  if (!existing.title.trim() || !existing.prompt.trim()) {
    return { error: "Save a title and prompt before publishing." };
  }
  if (!existing.class_period_id) {
    return { error: "Pick a class period before publishing." };
  }

  const { error } = await supabase
    .from("assignments")
    .update({ released_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { success: "Published." };
}
