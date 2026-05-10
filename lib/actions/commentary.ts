"use server";

/**
 * Mutations for Literary's commentary-development steps.
 *
 * cm_dev (chunk 4.5b1):
 *   - createWordCm / updateCmText / deleteCm
 *     The 5 starter word slots per CD come from writing-structure's
 *     bootstrap; this file's createWordCm handles the explicit
 *     [+ Add word] button.
 *
 * decisions + elaboration (chunk 4.5b2):
 *   - setBestForTs: strict — clears peer is_best_word_for_ts within
 *     the same body paragraph before setting the target. Two-statement,
 *     no transaction; transient zero-best state recoverable on next
 *     render.
 *   - setBestForChunk: independent toggle, any count.
 *   - createPhraseCm: append a kind='phrase' row under a CD.
 *
 * RLS chains via chunks → body_paragraphs → writing.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];

export async function createWordCm(
  writingId: string,
  chunkId: string,
  parentCdId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Next position among this CD's word CMs. We isolate to kind='word'
  // so word positions stay packed (1, 2, 3...) regardless of any
  // sentence-kind CMs that share the chunk.
  const { data: existing, error: exErr } = await supabase
    .from("commentary_items")
    .select("position")
    .eq("chunk_id", chunkId)
    .eq("parent_cd_id", parentCdId)
    .eq("kind", "word")
    .order("position", { ascending: false })
    .limit(1);
  if (exErr) {
    throw new Error(`createWordCm fetch: ${exErr.message}`);
  }
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("commentary_items").insert({
    chunk_id: chunkId,
    parent_cd_id: parentCdId,
    position: nextPos,
    text: "",
    kind: "word" as CmKind,
  });
  if (error) {
    throw new Error(`createWordCm: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function updateCmText(
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
    throw new Error(`updateCmText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function deleteCm(
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
    throw new Error(`deleteCm: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── decisions step ──────────────────────────────────────────────── */

/**
 * Strict TS-best: at most one is_best_word_for_ts=true per body
 * paragraph. Setting on a target clears the flag from all peer word
 * CMs within the same BP first. Un-setting (isBest=false) skips the
 * peer-clear and just clears the target.
 *
 * Two-statement, no transaction — transient zero-best state is
 * recoverable on next render. A single Postgres function would be
 * cleaner but isn't worth a migration mid-Phase 4.
 */
export async function setBestForTs(
  writingId: string,
  cmId: string,
  isBest: boolean
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  if (!isBest) {
    const { error } = await supabase
      .from("commentary_items")
      .update({ is_best_word_for_ts: false })
      .eq("id", cmId);
    if (error) {
      throw new Error(`setBestForTs (clear): ${error.message}`);
    }
    revalidatePath(`/student/writings/${writingId}`, "layout");
    return;
  }

  // Resolve target → its chunk → its BP → all chunks in that BP.
  // Single nested-embed read.
  const { data: target, error: tErr } = await supabase
    .from("commentary_items")
    .select(
      `
      id,
      chunk:chunks (
        body_paragraph:body_paragraphs (
          chunks ( id )
        )
      )
      `
    )
    .eq("id", cmId)
    .maybeSingle();
  if (tErr || !target) {
    throw new Error(`setBestForTs lookup: ${tErr?.message ?? "no row"}`);
  }
  const bpChunkIds = (
    target as unknown as {
      chunk: { body_paragraph: { chunks: Array<{ id: string }> } } | null;
    }
  ).chunk?.body_paragraph.chunks.map((c) => c.id) ?? [];

  if (bpChunkIds.length === 0) {
    throw new Error(`setBestForTs: could not resolve BP chunks for ${cmId}`);
  }

  // Clear peers within this BP.
  const { error: clearErr } = await supabase
    .from("commentary_items")
    .update({ is_best_word_for_ts: false })
    .in("chunk_id", bpChunkIds)
    .eq("kind", "word")
    .neq("id", cmId);
  if (clearErr) {
    throw new Error(`setBestForTs (clear peers): ${clearErr.message}`);
  }

  // Set target.
  const { error: setErr } = await supabase
    .from("commentary_items")
    .update({ is_best_word_for_ts: true })
    .eq("id", cmId);
  if (setErr) {
    throw new Error(`setBestForTs (set): ${setErr.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Soft chunk-best: any count of is_best_word_for_chunk=true per BP.
 * Independent of TS-best; the same word can be marked both.
 */
export async function setBestForChunk(
  writingId: string,
  cmId: string,
  isBest: boolean
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("commentary_items")
    .update({ is_best_word_for_chunk: isBest })
    .eq("id", cmId);
  if (error) {
    throw new Error(`setBestForChunk: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── elaboration step ────────────────────────────────────────────── */

/**
 * Append a kind='phrase' row under a CD. Position scoped to phrases
 * for this CD: the next position is max(existing phrase positions) + 1
 * (or 1 if none). No starter pre-population — students click [+ Add
 * phrase] explicitly.
 */
export async function createPhraseCm(
  writingId: string,
  chunkId: string,
  parentCdId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: existing, error: exErr } = await supabase
    .from("commentary_items")
    .select("position")
    .eq("chunk_id", chunkId)
    .eq("parent_cd_id", parentCdId)
    .eq("kind", "phrase")
    .order("position", { ascending: false })
    .limit(1);
  if (exErr) {
    throw new Error(`createPhraseCm fetch: ${exErr.message}`);
  }
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("commentary_items").insert({
    chunk_id: chunkId,
    parent_cd_id: parentCdId,
    position: nextPos,
    text: "",
    kind: "phrase" as CmKind,
  });
  if (error) {
    throw new Error(`createPhraseCm: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
