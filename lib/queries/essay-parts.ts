/**
 * Read for the essay-parts steps (thesis / introduction / conclusion).
 * Returns the writing's essay_parts row (1:1 via UNIQUE FK) — all
 * five fields. Caller filters which are relevant to its step.
 *
 * RLS chains via student_writings (per essay_parts_read in 0002).
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ThesisFrame = Database["public"]["Enums"]["jswp_thesis_frame"];

export interface EssayPartsData {
  id: string;
  thesis_text: string | null;
  thesis_frame: ThesisFrame | null;
  introduction_text: string | null;
  introduction_hook_kind: string | null;
  conclusion_text: string | null;
}

export async function getEssayParts(
  writingId: string
): Promise<EssayPartsData | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("essay_parts")
    .select(
      `
      id, thesis_text, thesis_frame,
      introduction_text, introduction_hook_kind,
      conclusion_text
      `
    )
    .eq("student_writing_id", writingId)
    .maybeSingle();

  if (error) {
    console.error("getEssayParts:", error);
    return null;
  }
  return data;
}
