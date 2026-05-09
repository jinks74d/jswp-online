/**
 * Read for the Gather-CDs step. Returns one gathering_cds_sheet per
 * body paragraph (positions 1..num_body_paragraphs), each with its
 * candidate_cds. Sheets and candidates both ordered.
 *
 * RLS scopes via auth_user_can_read_writing → student-only access on
 * their own writings (per gathering_cds_sheets_read +
 * candidate_cds_read in 0002).
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";

type ArgumentationSide = "pro" | "con" | "neutral";

export interface CandidateData {
  id: string;
  position: number;
  text: string;
  is_selected: boolean;
  selection_order: number | null;
  argumentation_side: ArgumentationSide | null;
}

export interface GatheringSheetData {
  id: string;
  body_paragraph_position: number;
  task_portion: string | null;
  candidates: CandidateData[];
}

interface RawSheetRow {
  id: string;
  body_paragraph_position: number;
  task_portion: string | null;
  candidates: Array<
    Omit<CandidateData, "argumentation_side"> & {
      argumentation_side: string | null;
    }
  >;
}

export async function getGatheringSheetsAndCandidates(
  writingId: string
): Promise<GatheringSheetData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("gathering_cds_sheets")
    .select(
      `
      id, body_paragraph_position, task_portion,
      candidates:candidate_cds (
        id, position, text, is_selected, selection_order, argumentation_side
      )
      `
    )
    .eq("student_writing_id", writingId)
    .order("body_paragraph_position", { ascending: true });

  if (error) {
    console.error("getGatheringSheetsAndCandidates:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawSheetRow[];

  return rows.map((r) => ({
    id: r.id,
    body_paragraph_position: r.body_paragraph_position,
    task_portion: r.task_portion,
    candidates: (r.candidates ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        position: c.position,
        text: c.text,
        is_selected: c.is_selected,
        selection_order: c.selection_order,
        argumentation_side: (c.argumentation_side ?? null) as
          | ArgumentationSide
          | null,
      })),
  }));
}
