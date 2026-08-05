/**
 * The rubric *document* — a PDF / Word / Excel file a teacher attaches to an
 * assignment, persisted as assignments.rubric_file_{path,name,mime}
 * (migration 0049).
 *
 * Deliberately separate from `lib/rubric.ts`, which owns the structured
 * criteria that grading and analytics read. The document is a reference: it
 * is shown, opened, and downloaded, never scored against. An assignment may
 * carry either, both, or neither.
 *
 * Imported by BOTH the client picker and the server action, so this module
 * stays free of `server-only` and of any Supabase import.
 */

export type RubricFile = {
  /** Storage key inside the assignment-sources bucket. */
  path: string;
  /** Original filename as uploaded — shown in the UI, used for download. */
  name: string;
  /** Resolved MIME type. May be "" if we could not determine one. */
  mime: string;
};

/**
 * The bucket's file_size_limit (migration 0003) is 20 MB and it rejects
 * anything larger with an opaque error. Check it client-side first so the
 * teacher gets a sentence they can act on instead of a storage failure.
 */
export const RUBRIC_FILE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Extension → MIME, for the formats rubrics actually arrive in. This table is
 * the source of truth in three places: the picker's `accept` attribute, the
 * fallback when a browser reports no type (common for .docx/.xlsx on Windows,
 * where the type depends on registry associations), and the human-readable
 * label. Every value here is in the bucket's allowed_mime_types after 0049 —
 * adding a row means widening that list in a new migration too.
 */
const RUBRIC_FILE_TYPES: ReadonlyArray<{
  ext: string;
  mime: string;
  label: string;
}> = [
  { ext: "pdf", mime: "application/pdf", label: "PDF" },
  {
    ext: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word document",
  },
  { ext: "doc", mime: "application/msword", label: "Word document" },
  {
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel workbook",
  },
  { ext: "xls", mime: "application/vnd.ms-excel", label: "Excel workbook" },
  { ext: "csv", mime: "text/csv", label: "CSV" },
  { ext: "rtf", mime: "application/rtf", label: "Rich text" },
  {
    ext: "odt",
    mime: "application/vnd.oasis.opendocument.text",
    label: "OpenDocument text",
  },
  {
    ext: "ods",
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    label: "OpenDocument spreadsheet",
  },
  { ext: "txt", mime: "text/plain", label: "Text file" },
  { ext: "png", mime: "image/png", label: "Image" },
  { ext: "jpg", mime: "image/jpeg", label: "Image" },
  { ext: "jpeg", mime: "image/jpeg", label: "Image" },
  { ext: "webp", mime: "image/webp", label: "Image" },
];

/** `accept` for the file input — extensions and MIME types, as browsers vary. */
export const RUBRIC_FILE_ACCEPT = [
  ...RUBRIC_FILE_TYPES.map((t) => `.${t.ext}`),
  ...new Set(RUBRIC_FILE_TYPES.map((t) => t.mime)),
].join(",");

/** Extensions only, for the "Upload a …" hint and the rejection message. */
export const RUBRIC_FILE_EXTENSIONS: readonly string[] = [
  ...new Set(RUBRIC_FILE_TYPES.map((t) => t.ext)),
];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Resolve the MIME type to upload with. The extension wins over the browser's
 * reported type: Supabase matches the upload's Content-Type against the
 * bucket allowlist, and browsers report "" or "application/octet-stream" for
 * Office files often enough that trusting them means spurious rejections.
 * Returns null when the extension is not one we accept.
 */
export function resolveRubricFileMime(
  fileName: string,
  reportedType?: string
): string | null {
  const known = RUBRIC_FILE_TYPES.find((t) => t.ext === extensionOf(fileName));
  if (known) return known.mime;
  // No usable extension — fall back to a reported type we recognize, so a
  // file saved without an extension still works when the browser knows better.
  const byType = RUBRIC_FILE_TYPES.find((t) => t.mime === reportedType);
  return byType ? byType.mime : null;
}

/** Short human label for the attached file, e.g. "PDF", "Excel workbook". */
export function rubricFileLabel(file: {
  name: string;
  mime?: string | null;
}): string {
  const byExt = RUBRIC_FILE_TYPES.find((t) => t.ext === extensionOf(file.name));
  if (byExt) return byExt.label;
  const byMime = RUBRIC_FILE_TYPES.find((t) => t.mime === file.mime);
  return byMime ? byMime.label : "Document";
}

export type RubricFileCheck =
  | { ok: true; mime: string }
  | { ok: false; error: string };

/**
 * Client-side gate before uploading. Rejects unsupported types and oversize
 * files with a message the teacher can act on.
 */
export function checkRubricFile(file: {
  name: string;
  type: string;
  size: number;
}): RubricFileCheck {
  const mime = resolveRubricFileMime(file.name, file.type);
  if (!mime) {
    return {
      ok: false,
      error: `That file type isn't supported. Upload one of: ${RUBRIC_FILE_EXTENSIONS.map(
        (e) => `.${e}`
      ).join(", ")}.`,
    };
  }
  if (file.size > RUBRIC_FILE_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `That file is ${mb} MB — the limit is ${
        RUBRIC_FILE_MAX_BYTES / 1024 / 1024
      } MB.`,
    };
  }
  return { ok: true, mime };
}

/**
 * Server-side parse of the `rubric_file` hidden input (JSON, like `rubric`
 * and `sources`). Returns:
 *   - a RubricFile when one is attached,
 *   - null when the field is absent/empty/malformed — meaning "no rubric file".
 *
 * `path` is NOT trusted as a capability: the caller re-scopes it to the
 * assignment's own storage folder before persisting, so a forged path cannot
 * point the row at another school's object.
 */
export function parseRubricFileInput(raw: unknown): RubricFile | null {
  if (raw == null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const path = typeof o.path === "string" ? o.path.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!path || !name) return null;
  return {
    path,
    name,
    mime: typeof o.mime === "string" ? o.mime : "",
  };
}

/**
 * Guard against a forged `path`. The client uploads the file itself (storage
 * RLS scopes that write to the teacher's own school), then posts the resulting
 * key back through the form — so the key arrives as untrusted input, and the
 * server both persists it and later DELETES whatever the row used to point at.
 * That combination is what makes the check load-bearing rather than cosmetic:
 *
 *   Save 1 — a teacher forges `path` to a colleague's rubric object.
 *   Save 2 — the row now "used to point at" that object, so the replace-sweep
 *            deletes someone else's file while their row still references it.
 *
 * A school-wide check does NOT stop that, because both teachers share a
 * school. The folder is therefore keyed to the TEACHER: a path is adoptable
 * only if it sits under the caller's own upload folder, so the sweep can only
 * ever reach objects that caller uploaded.
 *
 * Teacher-keyed rather than assignment-keyed because it has to be verifiable
 * in BOTH modes. On create the row does not exist yet, so there is no
 * assignment id to bind to — but `auth.uid()` is known either way.
 */
export function isRubricFilePathForTeacher(
  path: string,
  schoolId: string,
  teacherId: string
): boolean {
  return path.startsWith(rubricFolder(schoolId, teacherId));
}

/**
 * Storage folder for one teacher's uploaded rubric documents. Stays under the
 * `school-{uuid}/` prefix the bucket's RLS policies (migration 0003) key off,
 * so students in the school can still open the signed URL.
 */
export function rubricFolder(schoolId: string, teacherId: string): string {
  return `school-${schoolId}/teacher-${teacherId}/rubric/`;
}
