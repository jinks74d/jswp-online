"use server";

/**
 * Mutations for the T-chart step. RLS does the scoping at every level
 * — body_paragraphs / t_charts / chunks / concrete_details /
 * commentary_items all chain back to auth_user_can_write_writing
 * through joins (see migrations/0002_rls_policies.sql).
 *
 * NOTE: Pedagogically, gathering-CDs (chunk 4.5) precedes t-chart
 * in JSWP method. Our shipping order has 4.4 (this) before 4.5,
 * so students enter CDs manually here with candidate_cd_id = NULL.
 * When 4.5 ships, its bootstrap will promote candidate_cds.is_selected
 * = true rows into NEW concrete_details rows linked via
 * candidate_cd_id. Existing manual CDs (candidate_cd_id IS NULL)
 * are left alone — schema permits both paths.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];
type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];
type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];
type Mode = Database["public"]["Enums"]["jswp_mode"];

const CD_CM_MODES: ReadonlySet<Mode> = new Set([
  "expository",
  "argumentation",
  "literary",
]);

/* ─── Bootstrap: idempotent body_paragraphs + t_charts + chunks ────── */

interface BootstrapContext {
  writingId: string;
  mode: Mode;
  numBodyParagraphs: number;
  defaultChunksPerBp: number;
  hasCounterargument: boolean;
  chunkRatio: ChunkRatio;
}

/**
 * Idempotent: safe to call on every t-chart visit. Two concurrent
 * tabs racing to bootstrap the same writing won't create duplicates
 * — we use ignoreDuplicates upserts on every UNIQUE-keyed table.
 *
 * Starter content created with new chunks:
 *   - 1 empty concrete_detail (position 1)
 *   - 1 or 2 empty commentary_items (kind='sentence', linked to that CD)
 *     — Literary gets 2 to scaffold the 1:2+ ratio; others get 1.
 *
 * On re-bootstrap (chunk already exists), we don't add starter content
 * — the student's deletes are respected.
 */
export async function bootstrapTCharts(writingId: string): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // 1. Load writing + assignment context for the bootstrap.
  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(
      `
      id, chunk_ratio,
      assignment:assignment_id (
        mode, num_body_paragraphs, default_chunks_per_bp, has_counterargument
      )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }

  const a = (
    writing as unknown as {
      chunk_ratio: ChunkRatio;
      assignment: {
        mode: Mode;
        num_body_paragraphs: number;
        default_chunks_per_bp: number;
        has_counterargument: boolean;
      };
    }
  );

  const ctx: BootstrapContext = {
    writingId,
    mode: a.assignment.mode,
    numBodyParagraphs: a.assignment.num_body_paragraphs,
    defaultChunksPerBp: a.assignment.default_chunks_per_bp,
    hasCounterargument: a.assignment.has_counterargument,
    chunkRatio: a.chunk_ratio,
  };

  // 2. Upsert N body_paragraphs (positions 1..N), idempotent.
  const bpRows = Array.from({ length: ctx.numBodyParagraphs }, (_, i) => ({
    student_writing_id: writingId,
    position: i + 1,
    num_chunks: ctx.defaultChunksPerBp,
    has_counterargument: ctx.hasCounterargument,
  }));
  const { error: bpErr } = await supabase
    .from("body_paragraphs")
    .upsert(bpRows, {
      onConflict: "student_writing_id,position",
      ignoreDuplicates: true,
    });
  if (bpErr) {
    throw new Error(`bootstrapTCharts body_paragraphs: ${bpErr.message}`);
  }

  // 3. Re-fetch BPs to get their UUIDs.
  const { data: bps, error: bpFetchErr } = await supabase
    .from("body_paragraphs")
    .select("id, position")
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });
  if (bpFetchErr || !bps) {
    throw new Error(
      `bootstrapTCharts body_paragraphs fetch: ${bpFetchErr?.message ?? "no rows"}`
    );
  }

  // 4. Upsert t_charts for each BP (UNIQUE on body_paragraph_id).
  const tChartRows = bps.map((bp) => ({ body_paragraph_id: bp.id }));
  const { error: tcErr } = await supabase
    .from("t_charts")
    .upsert(tChartRows, {
      onConflict: "body_paragraph_id",
      ignoreDuplicates: true,
    });
  if (tcErr) {
    throw new Error(`bootstrapTCharts t_charts: ${tcErr.message}`);
  }

  // 5. Narrative writings have no chunks — done.
  if (!CD_CM_MODES.has(ctx.mode)) {
    revalidatePath(`/student/writings/${writingId}`, "layout");
    return;
  }

  // 6. Pre-fetch the writing's gathering sheets + selected candidates.
  // We need this for two reasons:
  //   (a) Decide whether to create a starter CD for newly-inserted
  //       chunks. If the BP's sheet has selected candidates, the
  //       promotion step will fill the chunk — skip the empty starter.
  //   (b) The promotion step itself runs after chunks are settled.
  // Empty array if the student hasn't visited gather-cds yet — that's
  // a no-op for promotion, and starter CDs get created normally.
  const sheetsByPosition = await fetchSheetsForPromotion(supabase, writingId);

  // 7. Figure out which (bp, position) chunk pairs are missing, INSERT
  // them, and merge the result with existingChunks for use by step 8
  // (starter-CD decision) and step 9 (promotion).
  const { data: existingChunks, error: ecErr } = await supabase
    .from("chunks")
    .select("id, body_paragraph_id, position")
    .in(
      "body_paragraph_id",
      bps.map((bp) => bp.id)
    );
  if (ecErr) {
    throw new Error(`bootstrapTCharts chunks fetch: ${ecErr.message}`);
  }
  const existingPairs = new Set(
    (existingChunks ?? []).map((c) => `${c.body_paragraph_id}:${c.position}`)
  );

  const missingChunks: Array<{
    body_paragraph_id: string;
    position: number;
    ratio: ChunkRatio;
  }> = [];
  for (const bp of bps) {
    for (let p = 1; p <= ctx.defaultChunksPerBp; p++) {
      if (!existingPairs.has(`${bp.id}:${p}`)) {
        missingChunks.push({
          body_paragraph_id: bp.id,
          position: p,
          ratio: ctx.chunkRatio,
        });
      }
    }
  }

  let insertedChunks: Array<{
    id: string;
    body_paragraph_id: string;
    position: number;
  }> = [];

  if (missingChunks.length > 0) {
    const { data, error: chunkInsErr } = await supabase
      .from("chunks")
      .insert(missingChunks)
      .select("id, body_paragraph_id, position");
    if (chunkInsErr) {
      // Race: another tab created chunks. Fall through to promotion;
      // the chunks must exist by now.
      if (chunkInsErr.code !== "23505") {
        throw new Error(`bootstrapTCharts chunk insert: ${chunkInsErr.message}`);
      }
    } else {
      insertedChunks = data ?? [];
    }
  }

  // 8. For each newly-inserted chunk, decide whether to create starter
  // content. If the BP's sheet has selected candidates, the promotion
  // step will fill the chunk — don't add an empty starter that the
  // student would just delete. Otherwise create starter CD + auto-CMs
  // (chunk 4.4 behavior).
  const bpById = new Map(bps.map((bp) => [bp.id, bp.position]));
  const cmCount = ctx.mode === "literary" ? 2 : 1;
  for (const chunk of insertedChunks) {
    const bpPosition = bpById.get(chunk.body_paragraph_id);
    if (bpPosition === undefined) continue;

    const sheet = sheetsByPosition.get(bpPosition);
    const hasSelectedCandidates =
      sheet?.candidates.some((c) => c.is_selected) ?? false;
    if (hasSelectedCandidates) {
      // Promotion will fill this chunk; skip starter CD.
      continue;
    }

    const { data: cd, error: cdErr } = await supabase
      .from("concrete_details")
      .insert({ chunk_id: chunk.id, position: 1, text: "" })
      .select("id")
      .single();
    if (cdErr || !cd) {
      console.error("bootstrap starter CD:", cdErr);
      continue;
    }
    const cmRows = Array.from({ length: cmCount }, (_, i) => ({
      chunk_id: chunk.id,
      parent_cd_id: cd.id,
      position: i + 1,
      text: "",
      kind: "sentence" as CmKind,
    }));
    const { error: cmErr } = await supabase
      .from("commentary_items")
      .insert(cmRows);
    if (cmErr) {
      console.error("bootstrap starter CMs:", cmErr);
    }
  }

  // 9. Promote is_selected candidates into concrete_details. Idempotent:
  // already-promoted candidates (matching candidate_cd_id on an existing
  // CD) are skipped. Runs on every bootstrap call so newly-selected
  // candidates from later gather-cds visits get picked up.
  const allChunks = [
    ...(existingChunks ?? []),
    ...insertedChunks,
  ];
  await promoteSelectedCandidates(
    supabase,
    bps,
    allChunks,
    sheetsByPosition,
    ctx.mode
  );

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── Promotion helpers (chunk 4.5 bridge) ─────────────────────────── */

interface SheetForPromotion {
  body_paragraph_position: number;
  candidates: Array<{
    id: string;
    position: number;
    text: string;
    is_selected: boolean;
    selection_order: number | null;
  }>;
}

async function fetchSheetsForPromotion(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  writingId: string
): Promise<Map<number, SheetForPromotion>> {
  const { data, error } = await supabase
    .from("gathering_cds_sheets")
    .select(
      `
      body_paragraph_position,
      candidates:candidate_cds (
        id, position, text, is_selected, selection_order
      )
      `
    )
    .eq("student_writing_id", writingId);
  if (error) {
    console.error("fetchSheetsForPromotion:", error);
    return new Map();
  }
  const map = new Map<number, SheetForPromotion>();
  for (const sheet of (data ?? []) as unknown as SheetForPromotion[]) {
    map.set(sheet.body_paragraph_position, sheet);
  }
  return map;
}

async function promoteSelectedCandidates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  bps: Array<{ id: string; position: number }>,
  allChunks: Array<{ id: string; body_paragraph_id: string; position: number }>,
  sheets: Map<number, SheetForPromotion>,
  mode: Mode
): Promise<void> {
  if (sheets.size === 0) return;

  const cmCount = mode === "literary" ? 2 : 1;

  for (const bp of bps) {
    const sheet = sheets.get(bp.position);
    if (!sheet) continue;

    const selected = sheet.candidates
      .filter((c) => c.is_selected)
      .sort(
        (a, b) =>
          (a.selection_order ?? Number.MAX_SAFE_INTEGER) -
            (b.selection_order ?? Number.MAX_SAFE_INTEGER) ||
          a.position - b.position
      );
    if (selected.length === 0) continue;

    // Promote into BP's chunk 1 (most common case: 1 chunk per BP).
    // Multi-chunk distribution is a polish concern; for now everything
    // lands in chunk 1 and the student rearranges via the t-chart UI.
    const firstChunk = allChunks
      .filter((c) => c.body_paragraph_id === bp.id)
      .sort((a, b) => a.position - b.position)[0];
    if (!firstChunk) continue;

    // Already-promoted candidate ids in this chunk.
    const { data: existingCds, error: ecdErr } = await supabase
      .from("concrete_details")
      .select("candidate_cd_id, position")
      .eq("chunk_id", firstChunk.id);
    if (ecdErr) {
      console.error("promoteSelectedCandidates fetch:", ecdErr);
      continue;
    }
    const promotedIds = new Set(
      (existingCds ?? [])
        .map((c) => c.candidate_cd_id)
        .filter((v): v is string => v !== null)
    );
    let nextPos =
      Math.max(0, ...((existingCds ?? []).map((c) => c.position))) + 1;

    for (const cand of selected) {
      if (promotedIds.has(cand.id)) continue;

      const { data: newCd, error: cdErr } = await supabase
        .from("concrete_details")
        .insert({
          chunk_id: firstChunk.id,
          position: nextPos++,
          text: cand.text,
          candidate_cd_id: cand.id,
        })
        .select("id")
        .single();
      if (cdErr || !newCd) {
        // 23505 race or other error — log and continue.
        console.error("promote insert:", cdErr);
        continue;
      }

      const cmRows = Array.from({ length: cmCount }, (_, i) => ({
        chunk_id: firstChunk.id,
        parent_cd_id: newCd.id,
        position: i + 1,
        text: "",
        kind: "sentence" as CmKind,
      }));
      const { error: cmErr } = await supabase
        .from("commentary_items")
        .insert(cmRows);
      if (cmErr) {
        console.error("promote starter CMs:", cmErr);
      }
    }
  }
}

/* ─── t_charts updates (TS, CS, narrative_*) ───────────────────────── */

export interface TChartFieldUpdates {
  working_topic_sentence?: string | null;
  revised_topic_sentence?: string | null;
  concluding_sentence?: string | null;
  // Narrative
  narrative_kind?: NarrativeKind | null;
  narrative_subject?: NarrativeSubject | null;
  narrative_key_word?: string | null;
  narrative_general_ideas?: string[] | null;
  narrative_concrete_example?: string | null;
  narrative_when?: string | null;
  narrative_where?: string | null;
  narrative_who?: string | null;
  narrative_what_happened?: string | null;
  narrative_dialogue?: string | null;
  narrative_feeling?: string | null;
  narrative_thinking?: string | null;
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

  // Starter CD + auto-CMs (literary gets 2, others get 1).
  const cmCount = mode === "literary" ? 2 : 1;
  const { data: cd, error: cdErr } = await supabase
    .from("concrete_details")
    .insert({ chunk_id: chunk.id, position: 1, text: "" })
    .select("id")
    .single();
  if (cdErr || !cd) {
    throw new Error(`addChunk starter CD: ${cdErr?.message ?? "no row"}`);
  }
  await supabase.from("commentary_items").insert(
    Array.from({ length: cmCount }, (_, i) => ({
      chunk_id: chunk.id,
      parent_cd_id: cd.id,
      position: i + 1,
      text: "",
      kind: "sentence" as CmKind,
    }))
  );

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
  mode: Mode
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

  // Auto-CMs (literary: 2, others: 1).
  const cmCount = mode === "literary" ? 2 : 1;
  await supabase.from("commentary_items").insert(
    Array.from({ length: cmCount }, (_, i) => ({
      chunk_id: chunkId,
      parent_cd_id: cd.id,
      position: i + 1, // local position within this CD's CMs is independent
      text: "",
      kind: "sentence" as CmKind,
    }))
  );

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

/* ─── commentary_items CRUD ────────────────────────────────────────── */

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
