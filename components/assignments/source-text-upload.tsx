"use client";

/**
 * File picker for source-text upload. Parses .txt locally and PDFs via
 * a dynamic import of `unpdf` (keeps the parser out of the initial
 * bundle). On extraction the parent receives the plain text via
 * onTextExtracted and writes it to the source_text textarea.
 *
 * Storage upload is best-effort — when assignmentId is provided (edit
 * mode) we also archive the original file under
 * school-{schoolId}/assignment-{assignmentId}/. Storage failures don't
 * block the form: text extraction is the primary outcome.
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Upload } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { uploadAssignmentSource } from "@/lib/storage/assignment-sources";

export function SourceTextUpload({
  assignmentId,
  schoolId,
  supabase,
  onTextExtracted,
}: {
  assignmentId?: string;
  schoolId: string;
  supabase: SupabaseClient<Database>;
  onTextExtracted: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setStatus("Extracting text…");

    try {
      const text = await extractText(file);
      onTextExtracted(text);

      // Best-effort archival to Storage when we have an assignment id.
      if (assignmentId) {
        setStatus("Uploading file for archival…");
        const result = await uploadAssignmentSource(supabase, {
          file,
          schoolId,
          assignmentId,
        });
        if (!result.ok) {
          // Non-fatal — extraction succeeded.
          console.warn("source upload failed:", result.error);
        }
      }

      setStatus(`Extracted ${text.length.toLocaleString()} characters.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus(null);
    } finally {
      setBusy(false);
      // Reset input so re-selecting the same file fires onChange.
      e.target.value = "";
    }
  }

  return (
    <div>
      <label
        htmlFor="source_file"
        className="block text-sm font-medium text-gray-700 mb-1.5"
      >
        Upload PDF or .txt to populate the body below
      </label>
      <div className="flex items-center gap-3">
        <input
          id="source_file"
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={handleFile}
          disabled={busy}
          className="block text-sm text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:disabled:opacity-50"
        />
        {busy && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" aria-hidden />
        )}
        {!busy && status && !error && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
            <Upload className="w-3.5 h-3.5" />
            {status}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

async function extractText(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const looksTxt = ext === "txt" || file.type === "text/plain";
  const looksPdf = ext === "pdf" || file.type === "application/pdf";

  if (looksTxt) {
    return file.text();
  }
  if (looksPdf) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const { extractText: extractPdfText, getDocumentProxy } = await import(
      "unpdf"
    );
    const pdf = await getDocumentProxy(buf);
    const result = await extractPdfText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    return text.trim();
  }

  throw new Error(`Unsupported file type: ${file.type || ext}. Use PDF or .txt.`);
}
