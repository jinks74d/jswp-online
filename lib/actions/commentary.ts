"use server";

/**
 * Mutations for Literary's commentary-development steps. Chunk 4.5b1
 * ships cm_dev's needs only:
 *   - createWordCm: explicit add-word for the [+ Add word] button
 *     (the 5 starter slots come from writing-structure's bootstrap)
 *   - updateCmText: autosave on blur
 *   - deleteCm: remove a row
 *
 * Decisions (setBestForTs / setBestForChunk) and elaboration
 * (createPhraseCm) actions land in chunk 4.5b2.
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
