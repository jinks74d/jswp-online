"use server";

/**
 * Mutations for the shaping_sheet step.
 *
 * - bootstrapShapingSheets: idempotent. One shaping_sheets row per
 *   body_paragraph (UNIQUE on body_paragraph_id) + one
 *   shaping_chunk_outputs per chunk per shaping_sheet (UNIQUE on
 *   shaping_sheet_id, chunk_id). Narrative skips chunk_outputs
 *   (no chunks). Race-safe via existing UNIQUE constraints.
 *
 * - updateShapingSheet: TS / CS / argumentation finals / notes
 *   (only the columns the caller passes).
 *
 * - updateChunkOutputCdSentences / updateChunkOutputCmSentences:
 *   replace the TEXT[] array atomically. Caller computes the new
 *   array client-side (add/edit/delete primitives implemented as
 *   array-rewrites for simplicity; trades a small write payload
 *   for clean semantics).
 *
 * Pick-n-stitch spending lives in lib/actions/t-charts.ts (see below).
 *   (used_in_topic_sentence / used_in_cm_sentence /
 *   used_in_concluding_sentence) on a commentary_items row.
 *
 * RLS chains via auth_user_can_write_writing through body_paragraphs
 * for shaping_sheets, and through shaping_sheets → BP for chunk
 * outputs (per migrations/0002_rls_policies.sql).
 *
 * NOTE: rules_applied (Dr. Louis's grammar rules) is intentionally
 * NOT exposed yet — lib/jswp-grammar-rules.ts isn't built. See
 * docs/BACKLOG.md "Grammar rules content" item.
 */

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import {
  carryForwardCmSentence,
  needsCmSeed,
} from "@/lib/shaping-carry-forward";

const CD_CM_MODES = new Set(["expository", "argumentation", "literary"]);

/* ─── Bootstrap ────────────────────────────────────────────────────── */

export async function bootstrapShapingSheets(writingId: string): Promise<void> {
  // Teacher review's CombinedView re-renders these step components in
  // read-only mode. Bootstrap is a student-only side effect; non-students
  // early-return rather than 403 to /forbidden.
  const profile = await requireUser();
  if (profile.role !== "student") return;
  const supabase = await createServerClient();

  // Fetch BPs + their chunks + the writing's mode (to skip chunks for narrative).
  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(`status, assignment:assignment_id ( mode )`)
    .eq("id", writingId)
    .maybeSingle();
  if (wErr || !writing) {
    throw new Error(`bootstrapShapingSheets: cannot load writing ${writingId}`);
  }
  const w = writing as unknown as {
    status: "draft" | "in_progress" | "submitted" | "returned" | "graded";
    assignment: { mode: string };
  };

  // Read-only states: skip bootstrap. RLS would reject the upserts.
  if (w.status === "submitted" || w.status === "graded") {
    return;
  }
  const mode = w.assignment.mode;

  const { data: bps, error: bpErr } = await supabase
    .from("body_paragraphs")
    // The T-Chart's commentary sentence rides along so the chunk outputs can
    // open holding it rather than empty — see lib/shaping-carry-forward.
    .select("id, t_chart:t_charts ( commentary_sentence ), chunks ( id, position )")
    .eq("student_writing_id", writingId);
  if (bpErr) {
    throw new Error(`bootstrapShapingSheets BPs fetch: ${bpErr.message}`);
  }

  const rows = (bps ?? []) as unknown as Array<{
    id: string;
    // 1:1 with the BP, but PostgREST types an embedded one-to-one as either a
    // row or an array depending on how it resolves the relationship.
    t_chart: { commentary_sentence: string | null } | null;
    chunks: Array<{ id: string; position: number }>;
  }>;
  if (rows.length === 0) return;

  // 1. Upsert shaping_sheets per BP.
  const sheetRows = rows.map((bp) => ({ body_paragraph_id: bp.id }));
  const { error: sErr } = await supabase
    .from("shaping_sheets")
    .upsert(sheetRows, {
      onConflict: "body_paragraph_id",
      ignoreDuplicates: true,
    });
  if (sErr) {
    throw new Error(`bootstrapShapingSheets sheets: ${sErr.message}`);
  }

  // 2. Re-fetch sheet IDs for chunk-outputs creation.
  const { data: sheets, error: sFetchErr } = await supabase
    .from("shaping_sheets")
    .select("id, body_paragraph_id")
    .in(
      "body_paragraph_id",
      rows.map((bp) => bp.id)
    );
  if (sFetchErr || !sheets) {
    throw new Error(
      `bootstrapShapingSheets sheet fetch: ${sFetchErr?.message ?? "no rows"}`
    );
  }

  // 3. For CD/CM modes only: upsert one chunk_output per (sheet, chunk).
  if (!CD_CM_MODES.has(mode)) return;

  const sheetByBp = new Map(sheets.map((s) => [s.body_paragraph_id, s.id]));
  // What each chunk's outputs should open holding: the paragraph's commentary
  // sentence, in its first chunk. cd_sentences stay empty — the CD is one
  // woven sentence the student writes here, not a list to inherit.
  const cmSeedByChunk = new Map<string, string[]>();
  const outputRows: Array<{
    shaping_sheet_id: string;
    chunk_id: string;
    cd_sentences: string[];
    cm_sentences: string[];
  }> = [];
  for (const bp of rows) {
    const sheetId = sheetByBp.get(bp.id);
    if (!sheetId) continue;
    const tChart = Array.isArray(bp.t_chart) ? bp.t_chart[0] : bp.t_chart;
    for (const [chunkId, seed] of carryForwardCmSentence(
      bp.chunks ?? [],
      tChart?.commentary_sentence
    )) {
      cmSeedByChunk.set(chunkId, seed);
    }
    for (const chunk of bp.chunks ?? []) {
      outputRows.push({
        shaping_sheet_id: sheetId,
        chunk_id: chunk.id,
        cd_sentences: [],
        cm_sentences: cmSeedByChunk.get(chunk.id) ?? [],
      });
    }
  }

  if (outputRows.length === 0) return;

  const { error: oErr } = await supabase
    .from("shaping_chunk_outputs")
    .upsert(outputRows, {
      onConflict: "shaping_sheet_id,chunk_id",
      ignoreDuplicates: true,
    });
  if (oErr) {
    throw new Error(`bootstrapShapingSheets outputs: ${oErr.message}`);
  }

  await seedExistingCmSentences(
    supabase,
    [...sheetByBp.values()],
    cmSeedByChunk
  );
}

/**
 * Carry commentary into chunk outputs that already exist and are still empty.
 *
 * The upsert above only seeds rows it INSERTS — ignoreDuplicates leaves an
 * existing row alone, which is what keeps bootstrap idempotent and is why it
 * cannot be the whole story: every writing that reached the Shaping Sheet
 * before this existed already has its rows, seeded with []. Without this pass
 * the rule would apply only to writings created from now on, and the ones that
 * actually lost their commentary would stay broken.
 *
 * Writes only where there is something to write: a row holding text is left
 * alone, and so is one whose chunk has no commentary yet. Once seeded a row is
 * no longer empty, so this settles to zero writes.
 */
async function seedExistingCmSentences(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  sheetIds: readonly string[],
  cmSeedByChunk: ReadonlyMap<string, string[]>
): Promise<void> {
  if (sheetIds.length === 0) return;

  const { data: existing, error } = await supabase
    .from("shaping_chunk_outputs")
    .select("id, chunk_id, cm_sentences")
    .in("shaping_sheet_id", [...sheetIds]);
  if (error) {
    throw new Error(`bootstrapShapingSheets seed fetch: ${error.message}`);
  }

  const pending = (existing ?? []).flatMap((row) => {
    if (!needsCmSeed(row.cm_sentences)) return [];
    const seed = cmSeedByChunk.get(row.chunk_id) ?? [];
    return seed.length > 0 ? [{ id: row.id, seed }] : [];
  });

  for (const { id, seed } of pending) {
    const { error: uErr } = await supabase
      .from("shaping_chunk_outputs")
      .update({ cm_sentences: seed })
      .eq("id", id);
    if (uErr) {
      throw new Error(`bootstrapShapingSheets seed write: ${uErr.message}`);
    }
  }
}

/* ─── shaping_sheets writes ────────────────────────────────────────── */

export interface ShapingSheetUpdates {
  final_topic_sentence?: string | null;
  final_concluding_sentence?: string | null;
  final_concession?: string | null;
  final_counterargument?: string | null;
  final_refutation?: string | null;
  notes?: string | null;
  // Five-move self-check (guide glossary pp.151-152). Move keys:
  // transitions | vary_openings | sentence_types | mechanics | voice.
  // Separate from rules_applied (reserved for the 15 Grammar Rules).
  revision_moves?: string[] | null;
  // Narrative shaping shape-blocks (CD1/CD2/CM); TS/CS reuse final_*.
  narrative_shaping_cd1?: string | null;
  narrative_shaping_cd2?: string | null;
  narrative_shaping_cm?: string | null;
}

export async function updateShapingSheet(
  writingId: string,
  sheetId: string,
  updates: ShapingSheetUpdates
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("shaping_sheets")
    .update(updates)
    .eq("id", sheetId);
  if (error) {
    throw new Error(`updateShapingSheet: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── shaping_chunk_outputs writes ─────────────────────────────────── */

/**
 * Replace the cd_sentences array on a chunk_output row. Caller passes
 * the full array; the action persists it atomically.
 */
export async function updateChunkOutputCdSentences(
  writingId: string,
  outputId: string,
  cdSentences: string[]
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("shaping_chunk_outputs")
    .update({ cd_sentences: cdSentences })
    .eq("id", outputId);
  if (error) {
    throw new Error(`updateChunkOutputCdSentences: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateChunkOutputCmSentences(
  writingId: string,
  outputId: string,
  cmSentences: string[]
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("shaping_chunk_outputs")
    .update({ cm_sentences: cmSentences })
    .eq("id", outputId);
  if (error) {
    throw new Error(`updateChunkOutputCmSentences: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── Pick-n-stitch ────────────────────────────────────────────────────
   Spending is written by setCommentaryItemUse / setCommentaryWebWordUse in
   lib/actions/t-charts.ts — one single-valued model shared by the T-Chart
   and the Shaping Sheet, so "when you use it, you lose it" means the same
   thing on both screens. The Shaping Sheet's old independent-boolean
   toggle (setCmFlag) is gone. */
