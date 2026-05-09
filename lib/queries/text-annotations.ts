/**
 * Read for the Read-and-Annotate step. RLS scopes via
 * auth_user_can_read_writing → student-only access on their own
 * writings (per text_annotations_read in 0002).
 *
 * Ordered by range_start ASC so the highlight-rendering algorithm
 * (which assumes ascending order for "first wins" overlap handling)
 * doesn't have to re-sort.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type TextAnnotationRow =
  Database["public"]["Tables"]["text_annotations"]["Row"];

export async function getAnnotations(
  writingId: string
): Promise<TextAnnotationRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("text_annotations")
    .select("*")
    .eq("student_writing_id", writingId)
    .order("range_start", { ascending: true });

  if (error) {
    console.error("getAnnotations:", error);
    return [];
  }
  return data ?? [];
}
