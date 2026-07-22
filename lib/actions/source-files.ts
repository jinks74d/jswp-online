"use server";

/**
 * Mints a short-lived signed URL for an assignment's uploaded source file
 * ("Open original"). Two entry points so both the pre-writing detail page
 * and the in-writing step surfaces can resolve a URL without threading the
 * file path through the client:
 *
 *   - getWritingSourceUrl(writingId)   — used by client step surfaces
 *     (annotate, reference panel). Resolves writing → assignment →
 *     source_file_path, then signs.
 *
 * RLS does the scoping at every hop: the student only reads their own
 * writing + its assignment, and the assignment-sources bucket read policy
 * (migration 0003) is school-scoped, so the signed URL only resolves for
 * users who may read the file. We mint on demand (5-min expiry) rather than
 * embed a stale URL, so this stays valid however long the page was open.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getAssignmentSourceSignedUrl } from "@/lib/storage/assignment-sources";

export type OpenSourceResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function getWritingSourceUrl(
  writingId: string
): Promise<OpenSourceResult> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("student_writings")
    .select("assignment:assignment_id ( source_file_path )")
    .eq("id", writingId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not load the assignment." };
  }

  // Supabase types the embed as an array-or-object; narrow defensively.
  const assignment = (data as { assignment?: { source_file_path: string | null } } | null)
    ?.assignment;
  const path = assignment?.source_file_path ?? null;
  if (!path) {
    return { ok: false, error: "No original file is attached." };
  }

  return getAssignmentSourceSignedUrl(supabase, path);
}

/**
 * Source-scoped variant for multi-source assignments: sign a specific source
 * file path, but only after verifying it belongs to one of the writing's
 * assignment's sources (or the legacy column). The bucket RLS still enforces
 * school scope; this membership check stops a student from signing an
 * arbitrary in-school path.
 */
export async function getWritingSourceUrlByPath(
  writingId: string,
  filePath: string
): Promise<OpenSourceResult> {
  if (!filePath) return { ok: false, error: "No original file is attached." };
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("student_writings")
    .select(
      "assignment:assignment_id ( source_file_path, assignment_sources ( source_file_path ) )"
    )
    .eq("id", writingId)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not load the assignment." };

  const assignment = (
    data as {
      assignment?: {
        source_file_path: string | null;
        assignment_sources?: { source_file_path: string | null }[];
      };
    } | null
  )?.assignment;

  const allowed = new Set<string>();
  if (assignment?.source_file_path) allowed.add(assignment.source_file_path);
  for (const s of assignment?.assignment_sources ?? []) {
    if (s.source_file_path) allowed.add(s.source_file_path);
  }
  if (!allowed.has(filePath)) {
    return { ok: false, error: "That file isn't part of this assignment." };
  }

  return getAssignmentSourceSignedUrl(supabase, filePath);
}
