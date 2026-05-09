/**
 * Helper for uploading a source-text file to the assignment-sources
 * Storage bucket. RLS-scoped (school-{school_id}/assignment-{id}/...)
 * — the bucket policies in migration 0003 enforce school + role.
 *
 * Callable from client OR server: takes the supabase client as a
 * parameter so the caller controls auth context. Failure is non-fatal
 * for the calling form — text extraction is the primary path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function uploadAssignmentSource(
  supabase: SupabaseClient<Database>,
  {
    file,
    schoolId,
    assignmentId,
  }: {
    file: File;
    schoolId: string;
    assignmentId: string;
  }
): Promise<UploadResult> {
  // Sanitize the filename to ASCII-safe; preserve the extension for
  // download UX.
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `school-${schoolId}/assignment-${assignmentId}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from("assignment-sources")
    .upload(path, file, { upsert: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
