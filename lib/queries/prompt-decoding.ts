/**
 * Read for the Decode-the-Prompt step. RLS scopes via
 * auth_user_can_read_writing → student-only access on their own
 * writings (per prompt_decodings_read in 0002).
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type PromptDecodingRow =
  Database["public"]["Tables"]["prompt_decodings"]["Row"];

export async function getPromptDecoding(
  writingId: string
): Promise<PromptDecodingRow | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("prompt_decodings")
    .select("*")
    .eq("student_writing_id", writingId)
    .maybeSingle();

  if (error) {
    console.error("getPromptDecoding:", error);
    return null;
  }
  return data;
}
