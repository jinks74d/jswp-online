/**
 * Read-only, display-only source renderer. Branches on the assignment's
 * `source_render_mode` to show the teacher's source as faithfully as the
 * mode allows:
 *
 *   - 'pdf'   → inline <iframe> of a short-lived signed URL (the browser's
 *               native PDF viewer), plus an "Open original" link. If the
 *               signed URL is missing (mint failed), falls back to the
 *               extracted plain text so the student is never left blank.
 *   - 'rich' + .docx file → DocxViewer (docx-preview) renders the actual Word
 *               file faithfully — images, tables, headings, fonts, layout.
 *   - 'rich' (typed/pasted, no file) → the sanitized `source_html` via
 *               dangerouslySetInnerHTML. HTML is sanitized at save time
 *               (lib/source-content) — the DB column is the choke point.
 *   - 'plain' → today's whitespace-pre-wrap projection of `source_text`.
 *
 * This component does NOT render annotation highlights and does NOT detect
 * selections — that is the job of SourceTextViewer on the annotate /
 * reference surfaces. This is purely "show the document." Safe to render in
 * a Server Component (no client interactivity).
 */

import { FileText } from "lucide-react";
import { DocxViewer } from "./docx-viewer";

type RenderMode = "pdf" | "rich" | "plain";

interface Props {
  /** assignments.source_render_mode; null is treated as 'plain'. */
  renderMode: RenderMode | null;
  /** assignments.source_text — the canonical plain projection. Always the
   *  fallback, and the body for 'plain' mode. */
  plainText: string;
  /** assignments.source_html — sanitized; used for typed/pasted rich sources
   *  (no uploaded file). */
  html?: string | null;
  /** Server-minted signed URL for the uploaded file — embeds the pdf and
   *  feeds the faithful docx renderer. */
  fileUrl?: string | null;
  /** assignments.source_file_name — labels "Open original" and distinguishes
   *  a .docx (faithful render) from a typed rich source (html). */
  fileName?: string | null;
}

function isDocx(fileName: string | null | undefined): boolean {
  return !!fileName && fileName.toLowerCase().endsWith(".docx");
}

export function SourceDocViewer({
  renderMode,
  plainText,
  html,
  fileUrl,
  fileName,
}: Props) {
  const mode: RenderMode = renderMode ?? "plain";

  const openOriginalLink = fileUrl ? (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      Open original{fileName ? ` (${fileName})` : ""}
    </a>
  ) : null;

  if (mode === "pdf" && fileUrl) {
    return (
      <div className="space-y-2">
        <iframe
          src={fileUrl}
          title={fileName ?? "Source document"}
          className="h-[36rem] w-full rounded-lg border border-gray-200 bg-gray-50"
        />
        {openOriginalLink}
      </div>
    );
  }

  // A real Word upload — render it faithfully (images, layout, fonts).
  if (mode === "rich" && fileUrl && isDocx(fileName)) {
    return (
      <div className="space-y-2">
        <DocxViewer fileUrl={fileUrl} />
        {openOriginalLink}
      </div>
    );
  }

  if (mode === "rich" && html) {
    return (
      <div
        className="source-doc leading-relaxed text-gray-900"
        // Sanitized at save time by lib/source-content (DOMPurify); the DB
        // column is the choke point.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // 'plain' — and the defensive fallback when a pdf/rich source is missing
  // its file/html (so the student always sees the text).
  return (
    <p className="whitespace-pre-wrap leading-relaxed text-gray-900">
      {plainText}
    </p>
  );
}
