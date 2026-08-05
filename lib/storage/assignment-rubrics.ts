/**
 * Storage helpers for the attached rubric document.
 *
 * Shares the `assignment-sources` bucket with source texts (see migration
 * 0049 for why: its RLS is already exactly school-read / teacher-write, keyed
 * off the `school-{uuid}/` path prefix, and a second bucket would be a
 * verbatim copy of those policies). Rubrics live under a `rubric/` segment so
 * the two never collide and either can be listed independently.
 *
 * Callable from client OR server — the caller passes the Supabase client and
 * therefore controls the auth context, matching assignment-sources.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { rubricFolder, resolveRubricFileMime } from "@/lib/rubric-file";

const BUCKET = "assignment-sources";

export type RubricUploadResult =
  | { ok: true; path: string; mime: string }
  | { ok: false; error: string };

export async function uploadRubricFile(
  supabase: SupabaseClient<Database>,
  {
    file,
    schoolId,
    teacherId,
  }: {
    file: File;
    schoolId: string;
    /** Folder owner. Keyed to the teacher, not the assignment, so the server
     *  can verify the posted path on create as well as edit — see
     *  isRubricFilePathForTeacher. */
    teacherId: string;
  }
): Promise<RubricUploadResult> {
  // Resolve from the extension rather than trusting file.type — Supabase
  // matches the upload's Content-Type against the bucket allowlist, and
  // browsers report "" or application/octet-stream for Office files often
  // enough that trusting them causes spurious "mime type not supported".
  const mime = resolveRubricFileMime(file.name, file.type);
  if (!mime) return { ok: false, error: "Unsupported file type." };

  // ASCII-safe key; the extension is preserved so downloads open correctly.
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${rubricFolder(schoolId, teacherId)}${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: mime });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path, mime };
}

export type RubricSignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Short-lived signed URL for opening the rubric. The bucket's school-scoped
 * read RLS still applies, so this only resolves for users who may read the
 * object. Default expiry 5 minutes — long enough to open in a new tab.
 */
export async function getRubricFileSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresIn = 300
): Promise<RubricSignedUrlResult> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not open the rubric." };
  }
  return { ok: true, url: data.signedUrl };
}

/** Best-effort cleanup. Callers treat failure as non-fatal. */
export async function removeRubricFile(
  supabase: SupabaseClient<Database>,
  path: string
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
