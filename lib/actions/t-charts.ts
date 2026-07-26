"use server";

/**
 * Mutations for the T-chart step. RLS does the scoping at every level
 * — body_paragraphs / t_charts / chunks / concrete_details /
 * commentary_items all chain back to auth_user_can_write_writing
 * through joins (see migrations/0002_rls_policies.sql).
 *
 * The structural bootstrap (BPs + chunks + starter CDs/CMs +
 * candidate promotion) lives in lib/actions/writing-structure.ts
 * and is called by both t-chart and Literary's cm-dev step entries.
 *
 * addChunk and createConcreteDetail delegate their per-mode starter-CM
 * layout to buildStarterCmRows so they stay consistent with bootstrap
 * (Literary: 5 word slots + 2 sentence slots; others: 1 sentence slot).
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { buildStarterCmRows } from "@/lib/actions/writing-structure";
import {
  isStitchTarget,
  withRayUse,
  type StitchTarget,
} from "@/lib/pick-n-stitch";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];
type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];
type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];
type Mode = Database["public"]["Enums"]["jswp_mode"];

/* ─── t_charts updates (TS, CS, narrative_*, argumentation drafts) ── */

export interface TChartFieldUpdates {
  working_topic_sentence?: string | null;
  revised_topic_sentence?: string | null;
  /** Full-width COMMENTARY SENTENCE row on the T-Chart (migration 0044). */
  commentary_sentence?: string | null;
  concluding_sentence?: string | null;
  // Argumentation drafts (written by argumentation.counterargument step,
  // chunk 4.6a). Polished into shaping_sheets.final_* by shaping step.
  concession?: string | null;
  counterargument?: string | null;
  refutation?: string | null;
  // Narrative
  narrative_kind?: NarrativeKind | null;
  narrative_subject?: NarrativeSubject | null;
  narrative_key_word?: string | null;
  narrative_general_ideas?: string[] | null;
  narrative_concrete_example?: string | null;
  narrative_when?: string | null;
  narrative_when_details?: string | null;
  narrative_where?: string | null;
  narrative_where_details?: string | null;
  narrative_who?: string | null;
  narrative_who_details?: string | null;
  narrative_what_happened?: string | null;
  narrative_dialogue?: string | null;
  narrative_feeling?: string | null;
  narrative_thinking?: string | null;
  narrative_thinking_2?: string | null;
  // Fictional Narrative ABC plan — chain links 2-6 ("Key" reuses narrative_key_word)
  abc_character?: string | null;
  abc_setting?: string | null;
  abc_back_story?: string | null;
  abc_conflict?: string | null;
  abc_end?: string | null;
}

export async function updateTChart(
  writingId: string,
  tChartId: string,
  updates: TChartFieldUpdates
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("t_charts")
    .update(updates)
    .eq("id", tChartId);

  if (error) {
    throw new Error(`Could not update t_chart: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── chunks add/remove ─────────────────────────────────────────────── */

export async function addChunk(
  writingId: string,
  bodyParagraphId: string,
  mode: Mode,
  ratio: ChunkRatio
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Find next position.
  const { data: existing, error: exErr } = await supabase
    .from("chunks")
    .select("position")
    .eq("body_paragraph_id", bodyParagraphId)
    .order("position", { ascending: false })
    .limit(1);
  if (exErr) {
    throw new Error(`addChunk fetch: ${exErr.message}`);
  }
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { data: chunk, error: insErr } = await supabase
    .from("chunks")
    .insert({
      body_paragraph_id: bodyParagraphId,
      position: nextPos,
      ratio,
    })
    .select("id")
    .single();
  if (insErr || !chunk) {
    throw new Error(`addChunk insert: ${insErr?.message ?? "no row"}`);
  }

  // Starter CD + per-mode/ratio CMs (Literary: 5 word + 2 sentence;
  // 3+:0: 0 sentence; other ratios: 1 sentence)
  const { data: cd, error: cdErr } = await supabase
    .from("concrete_details")
    .insert({ chunk_id: chunk.id, position: 1, text: "" })
    .select("id")
    .single();
  if (cdErr || !cd) {
    throw new Error(`addChunk starter CD: ${cdErr?.message ?? "no row"}`);
  }
  await supabase
    .from("commentary_items")
    .insert(buildStarterCmRows(chunk.id, cd.id, mode, ratio));

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function removeChunk(
  writingId: string,
  chunkId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase.from("chunks").delete().eq("id", chunkId);
  if (error) {
    throw new Error(`removeChunk: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── concrete_details CRUD ────────────────────────────────────────── */

export async function createConcreteDetail(
  writingId: string,
  chunkId: string,
  mode: Mode,
  ratio: ChunkRatio
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Next position for this chunk.
  const { data: existing, error: exErr } = await supabase
    .from("concrete_details")
    .select("position")
    .eq("chunk_id", chunkId)
    .order("position", { ascending: false })
    .limit(1);
  if (exErr) {
    throw new Error(`createConcreteDetail fetch: ${exErr.message}`);
  }
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { data: cd, error: insErr } = await supabase
    .from("concrete_details")
    .insert({ chunk_id: chunkId, position: nextPos, text: "" })
    .select("id")
    .single();
  if (insErr || !cd) {
    throw new Error(
      `createConcreteDetail insert: ${insErr?.message ?? "no row"}`
    );
  }

  // Per-mode/ratio starter CMs (Literary: 5 word + 2 sentence;
  // 3+:0: 0 sentence; other ratios: 1 sentence)
  await supabase
    .from("commentary_items")
    .insert(buildStarterCmRows(chunkId, cd.id, mode, ratio));

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateConcreteDetail(
  writingId: string,
  cdId: string,
  text: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("concrete_details")
    .update({ text })
    .eq("id", cdId);
  if (error) {
    throw new Error(`updateConcreteDetail: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Embedding Quotations (TLCD) on a CD. The "Mark as quotation" toggle and
 * its lead-in / citation fields are a T-Chart authoring aid mirroring the
 * guide's 2+:1 T-Chart (2024 Expository guide p.79). Toggling off is
 * non-destructive — the stored lead-in/citation are kept so an accidental
 * toggle never loses the student's work; the UI just collapses them and
 * the preview ignores them while is_quotation is false.
 */
export interface ConcreteDetailQuotationFields {
  isQuotation: boolean;
  transitionalLeadIn?: string | null;
  sourceCitation?: string | null;
}

export async function setConcreteDetailQuotation(
  writingId: string,
  cdId: string,
  fields: ConcreteDetailQuotationFields
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const updates: {
    is_quotation: boolean;
    transitional_lead_in?: string | null;
    source_citation?: string | null;
  } = { is_quotation: fields.isQuotation };
  if (fields.transitionalLeadIn !== undefined) {
    updates.transitional_lead_in = fields.transitionalLeadIn;
  }
  if (fields.sourceCitation !== undefined) {
    updates.source_citation = fields.sourceCitation;
  }

  const { error } = await supabase
    .from("concrete_details")
    .update(updates)
    .eq("id", cdId);
  if (error) {
    throw new Error(`setConcreteDetailQuotation: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function deleteConcreteDetail(
  writingId: string,
  cdId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Commentary items linked via parent_cd_id will have parent_cd_id
  // SET NULL automatically (per FK definition); we don't delete the
  // CMs themselves — the student may have written commentary worth
  // keeping that they can re-link or repurpose.
  const { error } = await supabase
    .from("concrete_details")
    .delete()
    .eq("id", cdId);
  if (error) {
    throw new Error(`deleteConcreteDetail: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── commentary_items CRUD (sentence-kind only; word/phrase live in
   lib/actions/commentary.ts from chunk 4.5b1) ───────────────────────── */

export async function createCommentaryItem(
  writingId: string,
  chunkId: string,
  parentCdId: string | null
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: existing, error: exErr } = await supabase
    .from("commentary_items")
    .select("position")
    .eq("chunk_id", chunkId)
    .order("position", { ascending: false })
    .limit(1);
  if (exErr) {
    throw new Error(`createCommentaryItem fetch: ${exErr.message}`);
  }
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("commentary_items").insert({
    chunk_id: chunkId,
    parent_cd_id: parentCdId,
    position: nextPos,
    text: "",
    kind: "sentence" as CmKind,
  });
  if (error) {
    throw new Error(`createCommentaryItem: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateCommentaryItem(
  writingId: string,
  cmId: string,
  text: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .update({ text })
    .eq("id", cmId);
  if (error) {
    throw new Error(`updateCommentaryItem: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Persist the commentary cloud's "web" — up to 4 brainstormed supporting words
 * shown on the oval's rays (Expository T-Chart, migration 0037). The caller
 * passes the full 4-slot array from local state on every save, so this is a
 * whole-array write (no stale-index race — mirrors the shaping SentenceList).
 * Empty trailing slots are stored as "" to keep index→ray alignment stable.
 */
export async function updateCommentaryWebWords(
  writingId: string,
  cmId: string,
  webWords: readonly string[]
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .update({ web_words: webWords.slice(0, 4) })
    .eq("id", cmId);
  if (error) {
    throw new Error(`updateCommentaryWebWords: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── Pick-n-Stitch: "once you use it, you lose it" ─────────────────
   Marking where a commentary word/phrase was spent so the T-Chart can
   strike it through and the student can see what is left for the other
   sentences. Two storage shapes (see lib/pick-n-stitch.ts): the oval is
   the commentary_items row itself; the rays are slots in web_words. */

/**
 * Spend (or release) one ray word/phrase. The whole web_word_uses array is
 * rewritten on every call so it stays index-aligned with web_words and no
 * stale index can race — same contract as updateCommentaryWebWords.
 *
 * `use` is single-valued on purpose: a phrase spent on the Revised TS is
 * gone from the CM and CS. Passing null releases it.
 */
export async function setCommentaryWebWordUse(
  writingId: string,
  cmId: string,
  slot: number,
  use: StitchTarget | null
): Promise<void> {
  await requireRole("student");
  if (use !== null && !isStitchTarget(use)) {
    throw new Error(`setCommentaryWebWordUse: bad target ${String(use)}`);
  }
  const supabase = await createServerClient();

  // Read-modify-write: the stored array is the source of truth for the
  // other three slots, so we never clobber them from stale client state.
  const { data: row, error: readErr } = await supabase
    .from("commentary_items")
    .select("web_word_uses")
    .eq("id", cmId)
    .single();
  if (readErr || !row) {
    throw new Error(
      `setCommentaryWebWordUse read: ${readErr?.message ?? "no row"}`
    );
  }

  const { error } = await supabase
    .from("commentary_items")
    .update({ web_word_uses: withRayUse(row.web_word_uses, slot, use) })
    .eq("id", cmId);
  if (error) {
    throw new Error(`setCommentaryWebWordUse: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Spend (or release) the cloud's oval sentence, via the used_in_* booleans
 * that have tracked this since migration 0001. Exactly one is set, so the
 * T-Chart's single-use rule holds even though the columns could express a
 * multi-use state (the Shaping Sheet toggles them independently).
 */
export async function setCommentaryItemUse(
  writingId: string,
  cmId: string,
  use: StitchTarget | null
): Promise<void> {
  await requireRole("student");
  if (use !== null && !isStitchTarget(use)) {
    throw new Error(`setCommentaryItemUse: bad target ${String(use)}`);
  }
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .update({
      used_in_topic_sentence: use === "ts",
      used_in_cm_sentence: use === "cm",
      used_in_concluding_sentence: use === "cs",
    })
    .eq("id", cmId);
  if (error) {
    throw new Error(`setCommentaryItemUse: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function deleteCommentaryItem(
  writingId: string,
  cmId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .delete()
    .eq("id", cmId);
  if (error) {
    throw new Error(`deleteCommentaryItem: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
