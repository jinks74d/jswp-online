/**
 * Shared structural bootstrap for the student writing flow. Creates
 * the body_paragraphs / t_charts / chunks / concrete_details /
 * commentary_items skeleton so downstream steps have valid foreign
 * keys to write against.
 *
 * Called from BOTH the t-chart step entry (chunk 4.4) and the
 * Literary cm-dev step entry (chunk 4.5b1, the first Literary step
 * to need chunk_id'd commentary_items). Idempotent on every call —
 * safe to invoke from any step's server entry.
 *
 * Race safety: every INSERT path is guarded by a UNIQUE constraint,
 * either via Supabase's `ignoreDuplicates` upsert or by being
 * downstream of a guarded chunk INSERT (so the losing tab early-exits
 * before reaching the unguarded child inserts).
 *
 * Per-mode starter content created for newly-inserted CDs:
 *   - Literary:           5 kind='word' slots (positions 1..5)
 *                       + 2 kind='sentence' slots (positions 6..7)
 *   - Expository / Argumentation: 1 kind='sentence' slot (position 1)
 *
 * The 5 word slots are pre-populated here (not in cm-dev's step
 * entry) so a single race-safe code path owns starter creation.
 * Two concurrent tabs racing into cm-dev or t-chart for the same
 * Literary CD see the same 5 slots, never 10.
 *
 * No revalidatePath: this function is called from RSC render in
 * t-chart-step.tsx and cm-dev-step.tsx (both dynamic = "force-dynamic").
 * Calling revalidatePath during render is unsupported in Next.js 15.5+
 * — it throws. Caller pages re-fetch on every render anyway, so
 * there's no cache to invalidate. Mutations triggered from form
 * actions (createWordCm, addChunk, etc.) handle revalidation in
 * their own files.
 *
 * NOTE: Pedagogically, gathering-CDs precedes t-chart and cm-dev.
 * Selected candidate_cds are promoted into concrete_details with
 * candidate_cd_id set; manually-typed CDs (no candidate) leave it
 * NULL. Schema permits both paths.
 */

import "server-only";
import { requireRole, requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];
type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];
type Mode = Database["public"]["Enums"]["jswp_mode"];

const CD_CM_MODES: ReadonlySet<Mode> = new Set([
  "expository",
  "argumentation",
  "literary",
]);

interface BootstrapContext {
  writingId: string;
  mode: Mode;
  numBodyParagraphs: number;
  defaultChunksPerBp: number;
  hasCounterargument: boolean;
  chunkRatio: ChunkRatio;
}

/**
 * Build the starter commentary_items rows for a newly-created CD.
 * Exposed so other action paths (addChunk, createConcreteDetail)
 * can stay consistent with bootstrap's per-mode layout.
 */
export function buildStarterCmRows(
  chunkId: string,
  cdId: string,
  mode: Mode
): Array<{
  chunk_id: string;
  parent_cd_id: string;
  position: number;
  text: string;
  kind: CmKind;
}> {
  const isLiterary = mode === "literary";
  const wordSlots = isLiterary ? 5 : 0;
  const sentenceSlots = isLiterary ? 2 : 1;

  const rows: ReturnType<typeof buildStarterCmRows> = [];

  for (let i = 0; i < wordSlots; i++) {
    rows.push({
      chunk_id: chunkId,
      parent_cd_id: cdId,
      position: i + 1,
      text: "",
      kind: "word",
    });
  }

  for (let i = 0; i < sentenceSlots; i++) {
    rows.push({
      chunk_id: chunkId,
      parent_cd_id: cdId,
      position: wordSlots + i + 1,
      text: "",
      kind: "sentence",
    });
  }

  return rows;
}

export async function bootstrapWritingStructure(
  writingId: string
): Promise<void> {
  // Teacher review's CombinedView re-renders these step components in
  // read-only mode. Bootstrap is a student-only side effect; non-students
  // early-return rather than 403 to /forbidden.
  const profile = await requireUser();
  if (profile.role !== "student") return;
  const supabase = await createServerClient();

  // 1. Load writing + assignment context.
  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(
      `
      id, chunk_ratio, status,
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

  const a = writing as unknown as {
    status: "draft" | "in_progress" | "submitted" | "returned" | "graded";
    chunk_ratio: ChunkRatio;
    assignment: {
      mode: Mode;
      num_body_paragraphs: number;
      default_chunks_per_bp: number;
      has_counterargument: boolean;
    };
  };

  // Read-only states: skip bootstrap. RLS would reject the upserts
  // anyway; failing fast here keeps step pages from surfacing 500s.
  if (a.status === "submitted" || a.status === "graded") {
    return;
  }

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
    throw new Error(`bootstrap body_paragraphs: ${bpErr.message}`);
  }

  // 3. Re-fetch BPs to get their UUIDs.
  const { data: bps, error: bpFetchErr } = await supabase
    .from("body_paragraphs")
    .select("id, position")
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });
  if (bpFetchErr || !bps) {
    throw new Error(
      `bootstrap body_paragraphs fetch: ${bpFetchErr?.message ?? "no rows"}`
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
    throw new Error(`bootstrap t_charts: ${tcErr.message}`);
  }

  // 5. Narrative writings have no chunks — done.
  if (!CD_CM_MODES.has(ctx.mode)) {
    return;
  }

  // 6. Pre-fetch gathering sheets + selected candidates for the
  // starter-CD decision and the promotion step.
  const sheetsByPosition = await fetchSheetsForPromotion(supabase, writingId);

  // 7. Insert missing chunks. Race-guarded by UNIQUE
  // (body_paragraph_id, position).
  const { data: existingChunks, error: ecErr } = await supabase
    .from("chunks")
    .select("id, body_paragraph_id, position")
    .in(
      "body_paragraph_id",
      bps.map((bp) => bp.id)
    );
  if (ecErr) {
    throw new Error(`bootstrap chunks fetch: ${ecErr.message}`);
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
      // 23505: another tab created chunks. Fall through to promotion;
      // the chunks must exist by now.
      if (chunkInsErr.code !== "23505") {
        throw new Error(`bootstrap chunk insert: ${chunkInsErr.message}`);
      }
    } else {
      insertedChunks = data ?? [];
    }
  }

  // 8. For each newly-inserted chunk, create starter content. Skip
  // when the BP's gather sheet has selected candidates — promotion
  // (step 9) will fill the chunk and we'd otherwise stack an empty
  // CD next to the promoted ones.
  const bpById = new Map(bps.map((bp) => [bp.id, bp.position]));
  for (const chunk of insertedChunks) {
    const bpPosition = bpById.get(chunk.body_paragraph_id);
    if (bpPosition === undefined) continue;

    const sheet = sheetsByPosition.get(bpPosition);
    const hasSelectedCandidates =
      sheet?.candidates.some((c) => c.is_selected) ?? false;
    if (hasSelectedCandidates) continue;

    const { data: cd, error: cdErr } = await supabase
      .from("concrete_details")
      .insert({ chunk_id: chunk.id, position: 1, text: "" })
      .select("id")
      .single();
    if (cdErr || !cd) {
      console.error("bootstrap starter CD:", cdErr);
      continue;
    }

    const { error: cmErr } = await supabase
      .from("commentary_items")
      .insert(buildStarterCmRows(chunk.id, cd.id, ctx.mode));
    if (cmErr) {
      console.error("bootstrap starter CMs:", cmErr);
    }
  }

  // 9. Promote is_selected candidates into concrete_details. Idempotent
  // via candidate_cd_id check; runs every call so newly-selected
  // candidates from later gather-cds visits get picked up.
  const allChunks = [...(existingChunks ?? []), ...insertedChunks];
  await promoteSelectedCandidates(
    supabase,
    bps,
    allChunks,
    sheetsByPosition,
    ctx.mode
  );
}

/* ─── Promotion helpers ───────────────────────────────────────────── */

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

    const firstChunk = allChunks
      .filter((c) => c.body_paragraph_id === bp.id)
      .sort((a, b) => a.position - b.position)[0];
    if (!firstChunk) continue;

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
        console.error("promote insert:", cdErr);
        continue;
      }

      const { error: cmErr } = await supabase
        .from("commentary_items")
        .insert(buildStarterCmRows(firstChunk.id, newCd.id, mode));
      if (cmErr) {
        console.error("promote starter CMs:", cmErr);
      }
    }
  }
}
