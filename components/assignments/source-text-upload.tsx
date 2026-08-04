"use client";

/**
 * File picker for source-text upload. Resolves a render mode by file type:
 *   - .txt → plain text (local read)
 *   - .pdf → PDF-native; pdf.js text (via buildPdfText) becomes the annotation
 *            substrate while the stored file is opened/rendered as the PDF
 *   - .docx → rich; mammoth converts to HTML (sanitized server-side on save)
 *   - .png / .jpg → image; the picture IS the source. No text can be
 *            extracted, so there is no annotation substrate — students view it
 *            and the annotate step releases its gate (same as a scanned PDF).
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
  renderMode: "pdf" | "rich" | "plain" | "image";
  /** Plain text for pdf/plain modes; "" for rich (server derives it) and
   *  for image (nothing to extract). */
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
  const [warning, setWarning] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setWarning(null);
    setStatus("Reading file…");

    try {
      const extracted = await extractSource(file);

      // Image-only (scanned) PDF: pdf.js found no text layer, so there is
      // nothing for students to highlight on the annotate step. Advise the
      // teacher to swap in a text-based PDF — but do NOT block: save proceeds.
      if (extracted.renderMode === "pdf" && extracted.text.trim() === "") {
        setWarning(
          "This PDF has no selectable text, so students won't be able to " +
            "highlight it. Consider uploading a text-based PDF instead."
        );
      }

      // An image has no text layer at all — students can read it on screen but
      // cannot highlight it, so the Read & Annotate step will let them past
      // without annotations. Say so up front; do NOT block.
      if (extracted.renderMode === "image") {
        setWarning(
          "Students can view this image but can't highlight it, so the " +
            "annotate step won't require annotations for it. Add a text or " +
            "PDF source too if you want them annotating."
        );
      }

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
            extracted.renderMode === "image"
              ? // The picture IS the source here — a failed archive leaves
                // nothing behind at all, so this is fatal for the source, not
                // a downgrade to extracted text.
                `Uploading the image failed (${result.error}). There is no ` +
                  `extracted text to fall back on, so this source is empty ` +
                  `until the upload succeeds — try re-selecting the file.`
              : `The text was extracted, but archiving the original file failed (${result.error}). ` +
                `The formatted document won't display until the upload succeeds — try re-selecting the file.`
          );
        }
      }

      onExtracted({ ...extracted, file: stored });

      const detail =
        extracted.renderMode === "rich"
          ? "Imported formatted document."
          : extracted.renderMode === "image"
            ? "Imported image."
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
        Upload a PDF, Word (.docx), .txt, or image (.png / .jpg) source
      </label>
      <div className="flex items-center gap-3">
        <input
          id="source_file"
          type="file"
          accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
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
      {warning && (
        <p role="status" className="mt-1 text-sm text-amber-700">
          {warning}
        </p>
      )}
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
  // Only png/jpeg: the bucket's allowed_mime_types (migration 0003) accepts
  // webp too, but the picker offers the two formats teachers actually export
  // from a phone camera, a scanner, or a slide deck.
  const looksImage =
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    file.type === "image/png" ||
    file.type === "image/jpeg";

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
  if (looksImage) {
    // Nothing to extract — the stored file is the whole source. Upload of the
    // original (below) is what makes this source non-empty.
    return { renderMode: "image", text: "", html: null };
  }
  if (looksDocx) {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = (await import("mammoth/mammoth.browser")).default;
    const result = await mammoth.convertToHtml({ arrayBuffer });
    // Sanitized server-side on save; source_text derived from the result.
    return { renderMode: "rich", text: "", html: result.value };
  }

  throw new Error(
    `Unsupported file type: ${file.type || ext}. Use PDF, .docx, .txt, .png, or .jpg.`
  );
}
