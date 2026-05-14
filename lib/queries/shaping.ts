/**
 * Shaping data fetch. Returns the writing's body_paragraphs joined to
 * shaping_sheets (1:1) joined to shaping_chunk_outputs (per chunk),
 * plus the underlying chunks → CDs → CMs tree so the shaping UI can
 * render the per-chunk woven sentence inputs and the side-panel
 * pick-n-stitch CM list in one round-trip.
 *
 * Narrative writings: shaping_sheets exists per BP, but no chunks +
 * no chunk_outputs (Narrative skips chunks entirely). The chunks/cds/
 * cms branches will be empty arrays.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];
type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export interface ShapingSheetData {
  id: string;
  final_topic_sentence: string | null;
  final_concluding_sentence: string | null;
  final_concession: string | null;
  final_counterargument: string | null;
  final_refutation: string | null;
  notes: string | null;
  narrative_shaping_cd1: string | null;
  narrative_shaping_cd2: string | null;
  narrative_shaping_cm: string | null;
}

export interface ChunkOutputData {
  id: string;
  chunk_id: string;
  cd_sentences: string[];
  cm_sentences: string[];
}

export interface ShapingCdData {
  id: string;
  position: number;
  text: string;
}

export interface ShapingCmData {
  id: string;
  position: number;
  text: string;
  kind: CmKind;
  parent_cd_id: string | null;
  is_best_word_for_ts: boolean;
  is_best_word_for_chunk: boolean;
  used_in_topic_sentence: boolean;
  used_in_cm_sentence: boolean;
  used_in_concluding_sentence: boolean;
}

export interface ShapingChunkData {
  id: string;
  position: number;
  output: ChunkOutputData | null;
  cds: ShapingCdData[];
  cms: ShapingCmData[];
}

export interface ShapingBpData {
  id: string;
  position: number;
  shaping_sheet: ShapingSheetData | null;
  // T-chart context that shaping reads but doesn't write
  working_topic_sentence: string | null;
  concluding_sentence: string | null;
  // Narrative WOW context (read-only on shaping)
  narrative_kind: NarrativeKind | null;
  narrative_subject: NarrativeSubject | null;
  narrative_key_word: string | null;
  narrative_concrete_example: string | null;
  narrative_when: string | null;
  narrative_where: string | null;
  narrative_who: string | null;
  narrative_what_happened: string | null;
  narrative_dialogue: string | null;
  narrative_feeling: string | null;
  narrative_thinking: string | null;
  chunks: ShapingChunkData[];
}

interface RawTChart {
  id: string;
  working_topic_sentence: string | null;
  concluding_sentence: string | null;
  narrative_kind: NarrativeKind | null;
  narrative_subject: NarrativeSubject | null;
  narrative_key_word: string | null;
  narrative_concrete_example: string | null;
  narrative_when: string | null;
  narrative_where: string | null;
  narrative_who: string | null;
  narrative_what_happened: string | null;
  narrative_dialogue: string | null;
  narrative_feeling: string | null;
  narrative_thinking: string | null;
}

interface RawShapingSheet extends ShapingSheetData {
  shaping_chunk_outputs: ChunkOutputData[];
}

interface RawBp {
  id: string;
  position: number;
  t_chart: RawTChart | RawTChart[] | null;
  shaping_sheet: RawShapingSheet | RawShapingSheet[] | null;
  chunks: Array<{
    id: string;
    position: number;
    concrete_details: ShapingCdData[];
    commentary_items: ShapingCmData[];
  }>;
}

export async function getShapingData(
  writingId: string
): Promise<ShapingBpData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position,
      t_chart:t_charts (
        id, working_topic_sentence, concluding_sentence,
        narrative_kind, narrative_subject,
        narrative_key_word, narrative_concrete_example,
        narrative_when, narrative_where, narrative_who,
        narrative_what_happened, narrative_dialogue,
        narrative_feeling, narrative_thinking
      ),
      shaping_sheet:shaping_sheets (
        id, final_topic_sentence, final_concluding_sentence,
        final_concession, final_counterargument, final_refutation,
        notes,
        narrative_shaping_cd1, narrative_shaping_cd2, narrative_shaping_cm,
        shaping_chunk_outputs (
          id, chunk_id, cd_sentences, cm_sentences
        )
      ),
      chunks (
        id, position,
        concrete_details ( id, position, text ),
        commentary_items (
          id, position, text, kind, parent_cd_id,
          is_best_word_for_ts, is_best_word_for_chunk,
          used_in_topic_sentence, used_in_cm_sentence,
          used_in_concluding_sentence
        )
      )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getShapingData:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawBp[];

  return rows.map((bp) => {
    const tc = Array.isArray(bp.t_chart) ? (bp.t_chart[0] ?? null) : bp.t_chart;
    const ss = Array.isArray(bp.shaping_sheet)
      ? (bp.shaping_sheet[0] ?? null)
      : bp.shaping_sheet;

    const outputsByChunk = new Map<string, ChunkOutputData>();
    if (ss) {
      for (const out of ss.shaping_chunk_outputs ?? []) {
        outputsByChunk.set(out.chunk_id, {
          id: out.id,
          chunk_id: out.chunk_id,
          cd_sentences: out.cd_sentences ?? [],
          cm_sentences: out.cm_sentences ?? [],
        });
      }
    }

    const chunks: ShapingChunkData[] = (bp.chunks ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((chunk) => ({
        id: chunk.id,
        position: chunk.position,
        output: outputsByChunk.get(chunk.id) ?? null,
        cds: (chunk.concrete_details ?? [])
          .slice()
          .sort((a, b) => a.position - b.position),
        cms: (chunk.commentary_items ?? [])
          .slice()
          .sort((a, b) => a.position - b.position),
      }));

    return {
      id: bp.id,
      position: bp.position,
      shaping_sheet: ss
        ? {
            id: ss.id,
            final_topic_sentence: ss.final_topic_sentence,
            final_concluding_sentence: ss.final_concluding_sentence,
            final_concession: ss.final_concession,
            final_counterargument: ss.final_counterargument,
            final_refutation: ss.final_refutation,
            notes: ss.notes,
            narrative_shaping_cd1: ss.narrative_shaping_cd1,
            narrative_shaping_cd2: ss.narrative_shaping_cd2,
            narrative_shaping_cm: ss.narrative_shaping_cm,
          }
        : null,
      working_topic_sentence: tc?.working_topic_sentence ?? null,
      concluding_sentence: tc?.concluding_sentence ?? null,
      narrative_kind: tc?.narrative_kind ?? null,
      narrative_subject: tc?.narrative_subject ?? null,
      narrative_key_word: tc?.narrative_key_word ?? null,
      narrative_concrete_example: tc?.narrative_concrete_example ?? null,
      narrative_when: tc?.narrative_when ?? null,
      narrative_where: tc?.narrative_where ?? null,
      narrative_who: tc?.narrative_who ?? null,
      narrative_what_happened: tc?.narrative_what_happened ?? null,
      narrative_dialogue: tc?.narrative_dialogue ?? null,
      narrative_feeling: tc?.narrative_feeling ?? null,
      narrative_thinking: tc?.narrative_thinking ?? null,
      chunks,
    };
  });
}
