/**
 * Commentary read shape for the Literary cm_dev / decisions /
 * elaboration steps. Returns each BP's chunks with their CDs and
 * commentary_items pre-grouped by kind so the UIs don't have to
 * filter on every render.
 *
 * Sentence-kind CMs are included for completeness (future shaping-
 * sheet work), but cm_dev only renders words; decisions only renders
 * words; elaboration renders phrases. RLS scopes everything via
 * auth_user_can_read_writing → bp → chunk → cm chain.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];

export interface CommentaryItemData {
  id: string;
  position: number;
  text: string;
  kind: CmKind;
  parent_cd_id: string | null;
  is_best_word_for_ts: boolean;
  is_best_word_for_chunk: boolean;
}

export interface CommentaryCdData {
  id: string;
  position: number;
  text: string;
  words: CommentaryItemData[];
  phrases: CommentaryItemData[];
  sentences: CommentaryItemData[];
}

export interface CommentaryChunkData {
  id: string;
  position: number;
  cds: CommentaryCdData[];
}

export interface CommentaryBpData {
  id: string;
  position: number;
  chunks: CommentaryChunkData[];
}

interface RawBpRow {
  id: string;
  position: number;
  chunks: Array<{
    id: string;
    position: number;
    concrete_details: Array<{
      id: string;
      position: number;
      text: string;
    }>;
    commentary_items: Array<{
      id: string;
      position: number;
      text: string;
      kind: CmKind;
      parent_cd_id: string | null;
      is_best_word_for_ts: boolean;
      is_best_word_for_chunk: boolean;
    }>;
  }>;
}

export async function getCommentaryByWriting(
  writingId: string
): Promise<CommentaryBpData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position,
      chunks (
        id, position,
        concrete_details ( id, position, text ),
        commentary_items (
          id, position, text, kind, parent_cd_id,
          is_best_word_for_ts, is_best_word_for_chunk
        )
      )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getCommentaryByWriting:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawBpRow[];

  return rows.map((bp) => ({
    id: bp.id,
    position: bp.position,
    chunks: (bp.chunks ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((chunk) => {
        const cdsByPosition = (chunk.concrete_details ?? [])
          .slice()
          .sort((a, b) => a.position - b.position);

        const cms = chunk.commentary_items ?? [];

        const cds: CommentaryCdData[] = cdsByPosition.map((cd) => {
          const cmsForCd = cms
            .filter((c) => c.parent_cd_id === cd.id)
            .slice()
            .sort((a, b) => a.position - b.position);
          return {
            id: cd.id,
            position: cd.position,
            text: cd.text,
            words: cmsForCd.filter((c) => c.kind === "word"),
            phrases: cmsForCd.filter((c) => c.kind === "phrase"),
            sentences: cmsForCd.filter((c) => c.kind === "sentence"),
          };
        });

        return {
          id: chunk.id,
          position: chunk.position,
          cds,
        };
      }),
  }));
}
