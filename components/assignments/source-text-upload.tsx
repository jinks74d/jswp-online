"use client";

/**
 * File picker for source-text upload. Resolves a render mode by file type:
 *   - .txt → plain text (local read)
 *   - .pdf → PDF-native; pdf.js text (via buildPdfText) becomes the annotation
 *            substrate while the stored file is opened/rendered as the PDF
 *   - .docx → rich; mammoth converts to HTML (sanitized server-side on save)
 * Parsers are dynamically imported to keep them out of the initial bundle.
 *
 * On extraction the parent receives an ExtractedSource payload. Storage
 * upload is best-effort and only when assignmentId is present (edit mode);
 * it archives the original under school-{schoolId}/assignment-{id}/ and
 * returns the path so the parent can persist it + offer "Open original".
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Upload } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { uploadAssignmentSource } from "@/lib/storage/assignment-sources";

export type ExtractedSource = {
  renderMode: "pdf" | "rich" | "plain";
  /** Plain text for pdf/plain modes; "" for rich (server derives it). */
  text: string;
  /** Rich HTML for rich mode; null otherwise. */
  html: string | null;
  /** Stored-file reference when archival succeeded (edit mode only). */
  file: { path: string; name: string; mime: string } | null;
};

export function SourceTextUpload({
  assignmentId,
  schoolId,
  supabase,
  onExtracted,
}: {
  assignmentId?: string;
  schoolId: string;
  supabase: SupabaseClient<Database>;
  onExtracted: (source: ExtractedSource) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setStatus("Reading file…");

    try {
      const extracted = await extractSource(file);

      // Best-effort archival to Storage when we have an assignment id.
      let stored: ExtractedSource["file"] = null;
      if (assignmentId) {
        setStatus("Uploading file…");
        const result = await uploadAssignmentSource(supabase, {
          file,
          schoolId,
          assignmentId,
        });
        if (result.ok) {
          stored = {
            path: result.path,
            name: file.name,
            mime: file.type || "",
          };
        } else {
          // Extraction succeeded but archival failed. Surface it — without the
          // stored original the assignment can only show extracted text, not
          // the formatted PDF/.docx, so the teacher must know it didn't land.
          console.warn("source upload failed:", result.error);
          setError(
            `The text was extracted, but archiving the original file failed (${result.error}). ` +
              `The formatted document won't display until the upload succeeds — try re-selecting the file.`
          );
        }
      }

      onExtracted({ ...extracted, file: stored });

      const detail =
        extracted.renderMode === "rich"
          ? "Imported formatted document."
          : `Extracted ${extracted.text.length.toLocaleString()} characters.`;
      setStatus(
        assignmentId || stored
          ? detail
          : `${detail} Save the draft, then re-open it to archive the original file.`
      );
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
        Upload a PDF, Word (.docx), or .txt source
      </label>
      <div className="flex items-center gap-3">
        <input
          id="source_file"
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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

type ExtractResult = Pick<ExtractedSource, "renderMode" | "text" | "html">;

async function extractSource(file: File): Promise<ExtractResult> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const looksTxt = ext === "txt" || file.type === "text/plain";
  const looksPdf = ext === "pdf" || file.type === "application/pdf";
  const looksDocx =
    ext === "docx" || file.type.includes("wordprocessingml");

  if (looksTxt) {
    const text = (await file.text()).trim();
    return { renderMode: "plain", text, html: null };
  }
  if (looksPdf) {
    const buf = new Uint8Array(await file.arrayBuffer());
    // pdf.js (not unpdf) is the single source of truth: the same buildPdfText
    // that drives the on-screen annotate text layer (Phase 3) produces the
    // stored substrate here, so a selection maps to a stable char offset by
    // construction. See docs/superpowers/specs/2026-06-16-pdf-annotate-design.md.
    const [{ loadPdfjs }, { buildPdfText, pageFromPdfJsItems }] =
      await Promise.all([import("@/lib/pdf-worker"), import("@/lib/pdf-text")]);
    const pdfjs = await loadPdfjs();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(pageFromPdfJsItems(content.items));
      page.cleanup();
    }
    const { text } = buildPdfText(pages);
    // Verbatim — NO trim. source_text must equal buildPdfText().text exactly so
    // annotation offsets, created against this string at render, never drift.
    return { renderMode: "pdf", text, html: null };
  }
  if (looksDocx) {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = (await import("mammoth/mammoth.browser")).default;
    const result = await mammoth.convertToHtml({ arrayBuffer });
    // Sanitized server-side on save; source_text derived from the result.
    return { renderMode: "rich", text: "", html: result.value };
  }

  throw new Error(
    `Unsupported file type: ${file.type || ext}. Use PDF, .docx, or .txt.`
  );
}
