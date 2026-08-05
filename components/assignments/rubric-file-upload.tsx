"use client";

/**
 * File picker for the attached rubric document (PDF / Word / Excel / …).
 *
 * Unlike the source-text picker this extracts NOTHING — the document is a
 * reference artifact, not an annotation substrate. It uploads to storage and
 * hands the parent a {path, name, mime} triple, which the form posts as a
 * hidden `rubric_file` input for the server action to persist.
 *
 * Upload happens at pick time (client-side, RLS-scoped) into the TEACHER's own
 * folder, not the assignment's. That is a security boundary, not a filing
 * preference: the server both persists the posted path and later deletes what
 * the row previously pointed at, so a path it cannot attribute to the caller
 * would let one teacher's save sweep another's file. It also means create mode
 * needs no assignment id — the folder is known before the row exists.
 *
 * Removing here only clears the form value; the stored object is swept
 * server-side once the save that orphans it actually succeeds.
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import type { Database } from "@/lib/database.types";
import {
  checkRubricFile,
  rubricFileLabel,
  RUBRIC_FILE_ACCEPT,
  type RubricFile,
} from "@/lib/rubric-file";
import {
  getRubricFileSignedUrl,
  uploadRubricFile,
} from "@/lib/storage/assignment-rubrics";

export function RubricFileUpload({
  teacherId,
  schoolId,
  supabase,
  value,
  onChange,
  /** Published assignments already carrying a rubric file: attach-only. */
  locked = false,
}: {
  teacherId: string;
  schoolId: string;
  supabase: SupabaseClient<Database>;
  value: RubricFile | null;
  onChange: (next: RubricFile | null) => void;
  locked?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so re-picking the same file still fires onChange.
    e.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);

    const check = checkRubricFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setBusy(true);
    try {
      const result = await uploadRubricFile(supabase, {
        file,
        schoolId,
        teacherId,
      });
      if (!result.ok) {
        setError(`Uploading the rubric failed (${result.error}). Try again.`);
        return;
      }
      onChange({ path: result.path, name: file.name, mime: result.mime });
      setNotice("Attached. Save the assignment to keep it.");
    } finally {
      setBusy(false);
    }
  }

  async function openFile() {
    if (!value) return;
    setError(null);
    const res = await getRubricFileSignedUrl(supabase, value.path);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        Rubric document
      </h3>

      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-300 bg-white px-3 py-2">
          <FileText className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
          <span className="text-sm text-gray-900 break-all">{value.name}</span>
          <span className="text-xs text-gray-500">
            {rubricFileLabel(value)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openFile}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 underline"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              Open
            </button>
            {!locked && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setNotice("Removed. Save the assignment to confirm.");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                <span>Remove</span>
                <span className="sr-only"> rubric document {value.name}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No rubric document attached.
        </p>
      )}

      {locked && value ? (
        <p className="text-xs text-gray-500">
          The rubric document is locked because this assignment is published —
          students may already have been graded against it. Unpublish to
          replace it.
        </p>
      ) : (
        <div>
          <label
            htmlFor="rubric_file"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {value
              ? "Replace with another file"
              : "Upload a rubric (PDF, Word, Excel, …)"}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="rubric_file"
              type="file"
              accept={RUBRIC_FILE_ACCEPT}
              onChange={handleFile}
              disabled={busy}
              className="block text-sm text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:disabled:opacity-50"
            />
            {busy && (
              <Loader2
                className="w-4 h-4 animate-spin text-gray-500"
                aria-hidden
              />
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Teachers and students can open this document. It sits alongside the
            criteria below — scoring still uses the criteria.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-xs text-gray-600">
          {notice}
        </p>
      )}
    </div>
  );
}
