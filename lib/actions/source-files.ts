"use server";

/**
 * Mints a short-lived signed URL for a specific assignment source file
 * ("Open original"), but only after verifying the path belongs to one of the
 * writing's assignment's sources. The bucket RLS still enforces school scope
 * (migration 0003); this membership check stops a student from signing an
 * arbitrary in-school path. Minted on demand (5-min expiry) so it stays valid
 * however long the page sat open.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getAssignmentSourceSignedUrl } from "@/lib/storage/assignment-sources";

export type OpenSourceResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function getWritingSourceUrlByPath(
  writingId: string,
  filePath: string
): Promise<OpenSourceResult> {
  if (!filePath) return { ok: false, error: "No original file is attached." };
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("student_writings")
    .select(
      "assignment:assignment_id ( assignment_sources ( source_file_path ) )"
    )
    .eq("id", writingId)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not load the assignment." };

  const assignment = (
    data as {
      assignment?: {
        assignment_sources?: { source_file_path: string | null }[];
      };
    } | null
  )?.assignment;

  const allowed = new Set<string>();
  for (const s of assignment?.assignment_sources ?? []) {
    if (s.source_file_path) allowed.add(s.source_file_path);
  }
  if (!allowed.has(filePath)) {
    return { ok: false, error: "That file isn't part of this assignment." };
  }

  return getAssignmentSourceSignedUrl(supabase, filePath);
}
