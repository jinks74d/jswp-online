/**
 * Paragraph-form data fetch. Per BP, returns:
 *   - paragraph_forms row (final_text, word_count) — the editable target
 *   - shaping_sheets fields (final_TS, final_CS, final_C/CA/R) — read-only context
 *   - per-chunk shaping_chunk_outputs (cd_sentences[], cm_sentences[]) — read-only
 *   - narrative WOW + discovery context (read-only) for Narrative mode
 *
 * One round-trip via Supabase nested embed. RLS chains via
 * body_paragraphs → student_writings.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export interface ParagraphFormRowData {
  id: string;
  final_text: string;
}

export interface ShapingContextData {
  final_topic_sentence: string | null;
  final_concluding_sentence: string | null;
  final_concession: string | null;
  final_counterargument: string | null;
  final_refutation: string | null;
}

export interface ChunkContextData {
  id: string;
  position: number;
  cd_sentences: string[];
  cm_sentences: string[];
}

export interface ParagraphFormBpData {
  id: string;
  position: number;
  paragraph_form: ParagraphFormRowData | null;
  shaping: ShapingContextData | null;
  // Working/draft fallbacks if shaping_sheets fields are empty
  working_topic_sentence: string | null;
  concluding_sentence: string | null;
  // Narrative WOW + discovery (read-only context)
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
  chunks: ChunkContextData[];
}

interface RawTChart {
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

interface RawShapingSheet {
  final_topic_sentence: string | null;
  final_concluding_sentence: string | null;
  final_concession: string | null;
  final_counterargument: string | null;
  final_refutation: string | null;
  shaping_chunk_outputs: Array<{
    chunk_id: string;
    cd_sentences: string[] | null;
    cm_sentences: string[] | null;
  }>;
}

interface RawParagraphForm {
  id: string;
  final_text: string;
}

interface RawBp {
  id: string;
  position: number;
  paragraph_form: RawParagraphForm | RawParagraphForm[] | null;
  t_chart: RawTChart | RawTChart[] | null;
  shaping_sheet: RawShapingSheet | RawShapingSheet[] | null;
  chunks: Array<{ id: string; position: number }>;
}

export async function getParagraphFormData(
  writingId: string
): Promise<ParagraphFormBpData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position,
      paragraph_form:paragraph_forms ( id, final_text ),
      t_chart:t_charts (
        working_topic_sentence, concluding_sentence,
        narrative_kind, narrative_subject,
        narrative_key_word, narrative_concrete_example,
        narrative_when, narrative_where, narrative_who,
        narrative_what_happened, narrative_dialogue,
        narrative_feeling, narrative_thinking
      ),
      shaping_sheet:shaping_sheets (
        final_topic_sentence, final_concluding_sentence,
        final_concession, final_counterargument, final_refutation,
        shaping_chunk_outputs ( chunk_id, cd_sentences, cm_sentences )
      ),
      chunks ( id, position )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getParagraphFormData:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawBp[];

  return rows.map((bp) => {
    const pf = Array.isArray(bp.paragraph_form)
      ? (bp.paragraph_form[0] ?? null)
      : bp.paragraph_form;
    const tc = Array.isArray(bp.t_chart) ? (bp.t_chart[0] ?? null) : bp.t_chart;
    const ss = Array.isArray(bp.shaping_sheet)
      ? (bp.shaping_sheet[0] ?? null)
      : bp.shaping_sheet;

    // Map chunk_id → cd_sentences/cm_sentences for fast lookup.
    const outputsByChunk = new Map<
      string,
      { cd: string[]; cm: string[] }
    >();
    if (ss) {
      for (const out of ss.shaping_chunk_outputs ?? []) {
        outputsByChunk.set(out.chunk_id, {
          cd: out.cd_sentences ?? [],
          cm: out.cm_sentences ?? [],
        });
      }
    }

    const chunks: ChunkContextData[] = (bp.chunks ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => {
        const out = outputsByChunk.get(c.id);
        return {
          id: c.id,
          position: c.position,
          cd_sentences: out?.cd ?? [],
          cm_sentences: out?.cm ?? [],
        };
      });

    return {
      id: bp.id,
      position: bp.position,
      paragraph_form: pf,
      shaping: ss
        ? {
            final_topic_sentence: ss.final_topic_sentence,
            final_concluding_sentence: ss.final_concluding_sentence,
            final_concession: ss.final_concession,
            final_counterargument: ss.final_counterargument,
            final_refutation: ss.final_refutation,
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
