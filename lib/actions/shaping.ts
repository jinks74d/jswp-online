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
 * - setCmFlag: toggle one of the three pick-n-stitch flags
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
    .select("id, chunks ( id )")
    .eq("student_writing_id", writingId);
  if (bpErr) {
    throw new Error(`bootstrapShapingSheets BPs fetch: ${bpErr.message}`);
  }

  const rows = (bps ?? []) as unknown as Array<{
    id: string;
    chunks: Array<{ id: string }>;
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
  const outputRows: Array<{
    shaping_sheet_id: string;
    chunk_id: string;
    cd_sentences: string[];
    cm_sentences: string[];
  }> = [];
  for (const bp of rows) {
    const sheetId = sheetByBp.get(bp.id);
    if (!sheetId) continue;
    for (const chunk of bp.chunks ?? []) {
      outputRows.push({
        shaping_sheet_id: sheetId,
        chunk_id: chunk.id,
        cd_sentences: [],
        cm_sentences: [],
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
}

/* ─── shaping_sheets writes ────────────────────────────────────────── */

export interface ShapingSheetUpdates {
  final_topic_sentence?: string | null;
  final_concluding_sentence?: string | null;
  final_concession?: string | null;
  final_counterargument?: string | null;
  final_refutation?: string | null;
  notes?: string | null;
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

/* ─── Pick-n-stitch flags ──────────────────────────────────────────── */

export type PickNStitchFlag =
  | "used_in_topic_sentence"
  | "used_in_cm_sentence"
  | "used_in_concluding_sentence";

export async function setCmFlag(
  writingId: string,
  cmId: string,
  flag: PickNStitchFlag,
  value: boolean
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .update({ [flag]: value })
    .eq("id", cmId);
  if (error) {
    throw new Error(`setCmFlag(${flag}): ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
