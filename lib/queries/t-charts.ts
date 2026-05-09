/**
 * T-chart data fetch. Returns the writing's full body_paragraphs →
 * t_charts → chunks → CDs/CMs tree in a single round-trip via
 * Supabase nested select.
 *
 * The returned shape mirrors the schema:
 *   body_paragraphs[]
 *     ├── t_chart (1:1 via UNIQUE FK)
 *     └── chunks[] (positioned)
 *         ├── concrete_details[] (positioned)
 *         └── commentary_items[] (positioned, with optional parent_cd_id)
 *
 * Narrative writings have body_paragraphs and t_charts but no chunks
 * (the WOW form fields live on t_charts directly). The chunks array
 * will simply be empty for those.
 *
 * RLS scopes via the chain auth_user_can_read_writing → body_paragraphs
 * → ... — the caller sees only their own writing's tree.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];
type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];
type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export interface TChartRowData {
  id: string;
  working_topic_sentence: string | null;
  revised_topic_sentence: string | null;
  concluding_sentence: string | null;
  // Argumentation extensions (written by the separate argumentation.counterargument step)
  concession: string | null;
  counterargument: string | null;
  refutation: string | null;
  // Narrative extensions
  narrative_kind: NarrativeKind | null;
  narrative_subject: NarrativeSubject | null;
  narrative_key_word: string | null;
  narrative_general_ideas: string[] | null;
  narrative_concrete_example: string | null;
  narrative_when: string | null;
  narrative_where: string | null;
  narrative_who: string | null;
  narrative_what_happened: string | null;
  narrative_dialogue: string | null;
  narrative_feeling: string | null;
  narrative_thinking: string | null;
}

export interface ConcreteDetailData {
  id: string;
  position: number;
  text: string;
  is_quotation: boolean;
}

export interface CommentaryItemData {
  id: string;
  position: number;
  text: string;
  parent_cd_id: string | null;
  kind: CmKind;
}

export interface ChunkData {
  id: string;
  position: number;
  ratio: ChunkRatio;
  concrete_details: ConcreteDetailData[];
  commentary_items: CommentaryItemData[];
}

export interface BodyParagraphData {
  id: string;
  position: number;
  label: string | null;
  num_chunks: number;
  has_counterargument: boolean;
  t_chart: TChartRowData | null;
  chunks: ChunkData[];
}

interface RawRow {
  id: string;
  position: number;
  label: string | null;
  num_chunks: number;
  has_counterargument: boolean;
  t_chart: TChartRowData | TChartRowData[] | null;
  chunks: Array<
    Omit<ChunkData, "concrete_details" | "commentary_items"> & {
      concrete_details: ConcreteDetailData[];
      commentary_items: CommentaryItemData[];
    }
  >;
}

export async function getTChartData(
  writingId: string
): Promise<BodyParagraphData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position, label, num_chunks, has_counterargument,
      t_chart:t_charts (
        id, working_topic_sentence, revised_topic_sentence, concluding_sentence,
        concession, counterargument, refutation,
        narrative_kind, narrative_subject, narrative_key_word,
        narrative_general_ideas, narrative_concrete_example,
        narrative_when, narrative_where, narrative_who,
        narrative_what_happened, narrative_dialogue,
        narrative_feeling, narrative_thinking
      ),
      chunks (
        id, position, ratio,
        concrete_details ( id, position, text, is_quotation ),
        commentary_items ( id, position, text, parent_cd_id, kind )
      )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getTChartData:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawRow[];

  // Supabase nested embeds may return either a single object or an
  // array depending on relationship cardinality detection. UNIQUE FKs
  // can be either. Normalize to a single row.
  return rows.map((r) => {
    const tChart = Array.isArray(r.t_chart) ? (r.t_chart[0] ?? null) : r.t_chart;
    const chunks = (r.chunks ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        position: c.position,
        ratio: c.ratio,
        concrete_details: (c.concrete_details ?? [])
          .slice()
          .sort((a, b) => a.position - b.position),
        commentary_items: (c.commentary_items ?? [])
          .slice()
          .sort((a, b) => a.position - b.position),
      }));
    return {
      id: r.id,
      position: r.position,
      label: r.label,
      num_chunks: r.num_chunks,
      has_counterargument: r.has_counterargument,
      t_chart: tChart,
      chunks,
    };
  });
}
