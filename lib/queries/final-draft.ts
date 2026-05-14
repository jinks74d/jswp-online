/**
 * Read for the final-draft step. Returns:
 *   - the writing's final_drafts row (1:1 via UNIQUE FK)
 *   - assembly source: introduction_text + per-BP paragraph_forms
 *     (ordered by BP position) + conclusion_text
 *
 * The assembly source is what the [Assemble from pieces] button
 * concatenates. Empty pieces are kept in the result so the UI can
 * render "(introduction not written yet)" / "(BP N not written yet)"
 * panels with back-links — pedagogical reminder, not a gate.
 *
 * RLS chains via student_writings.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export interface FinalDraftRowData {
  id: string;
  title: string | null;
  full_text: string;
}

export interface AssemblyParagraph {
  bp_id: string;
  bp_position: number;
  final_text: string;
  // Narrative layout context (guide p. 59) — drives the BP label.
  narrative_kind: NarrativeKind | null;
  narrative_subject: NarrativeSubject | null;
}

export interface AssemblySource {
  introduction_text: string;
  paragraphs: AssemblyParagraph[];
  conclusion_text: string;
}

export interface FinalDraftData {
  final_draft: FinalDraftRowData | null;
  assembly: AssemblySource;
}

interface RawWriting {
  final_draft: FinalDraftRowData | FinalDraftRowData[] | null;
  essay_parts:
    | {
        introduction_text: string | null;
        conclusion_text: string | null;
      }
    | Array<{
        introduction_text: string | null;
        conclusion_text: string | null;
      }>
    | null;
}

interface RawTChart {
  narrative_kind: NarrativeKind | null;
  narrative_subject: NarrativeSubject | null;
}

interface RawBp {
  id: string;
  position: number;
  paragraph_form:
    | { final_text: string }
    | Array<{ final_text: string }>
    | null;
  t_chart: RawTChart | RawTChart[] | null;
}

export async function getFinalDraftData(
  writingId: string
): Promise<FinalDraftData> {
  const supabase = await createServerClient();

  // One round-trip on student_writings (final_draft + essay_parts).
  const { data: writingRow, error: wErr } = await supabase
    .from("student_writings")
    .select(
      `
      final_draft:final_drafts ( id, title, full_text ),
      essay_parts ( introduction_text, conclusion_text )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writingRow) {
    console.error("getFinalDraftData writing:", wErr);
    return {
      final_draft: null,
      assembly: { introduction_text: "", paragraphs: [], conclusion_text: "" },
    };
  }

  const w = writingRow as unknown as RawWriting;
  const fd = Array.isArray(w.final_draft)
    ? (w.final_draft[0] ?? null)
    : w.final_draft;
  const ep = Array.isArray(w.essay_parts)
    ? (w.essay_parts[0] ?? null)
    : w.essay_parts;

  // Second round-trip: BPs with their paragraph_forms + narrative layout.
  const { data: bps, error: bpErr } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position,
      paragraph_form:paragraph_forms ( final_text ),
      t_chart:t_charts ( narrative_kind, narrative_subject )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });
  if (bpErr) {
    console.error("getFinalDraftData BPs:", bpErr);
  }

  const paragraphs: AssemblyParagraph[] = ((bps ?? []) as unknown as RawBp[]).map(
    (bp) => {
      const pf = Array.isArray(bp.paragraph_form)
        ? (bp.paragraph_form[0] ?? null)
        : bp.paragraph_form;
      const tc = Array.isArray(bp.t_chart)
        ? (bp.t_chart[0] ?? null)
        : bp.t_chart;
      return {
        bp_id: bp.id,
        bp_position: bp.position,
        final_text: pf?.final_text ?? "",
        narrative_kind: tc?.narrative_kind ?? null,
        narrative_subject: tc?.narrative_subject ?? null,
      };
    }
  );

  return {
    final_draft: fd,
    assembly: {
      introduction_text: ep?.introduction_text ?? "",
      paragraphs,
      conclusion_text: ep?.conclusion_text ?? "",
    },
  };
}
