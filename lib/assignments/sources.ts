/**
 * Assignment source-text parsing and column resolution.
 *
 * Extracted verbatim from lib/actions/assignments.ts — see parse-form.ts for
 * why. The writers (writeAssignmentSources, appendAssignmentSources) stay in
 * the action module: they touch Supabase and the assignment-sources bucket.
 *
 * This module transitively imports lib/source-content, which is `server-only`
 * because DOMPurify's DOM provider pulls in jsdom. That guard is inert under
 * vitest (vite.config.ts aliases the marker to test-stubs/server-only.ts) and
 * still enforced by the Next.js bundler, which is where it matters.
 */

import { sanitizeSourceHtml, sourceHtmlToSubstrate } from "@/lib/source-content";
import { emptyToNull } from "./parse-form";

export const VALID_RENDER_MODES = new Set(["pdf", "rich", "plain", "image"]);

/**
 * One source as posted by the client repeater. `source_text` is carried
 * verbatim (untrimmed) so the PDF substrate stays byte-for-byte equal to the
 * pdf.js buildPdfText() output the annotate text layer reproduces at render —
 * trimming would shift every annotation offset.
 */
export type SourceInput = {
  /** assignment_sources.id for a row that already exists; "" for a new one.
   *  The published path appends the new ones and ignores the rest. */
  source_id: string;
  kind: "primary" | "secondary";
  source_title: string;
  source_author: string;
  source_citation: string;
  source_url: string;
  source_html: string;
  source_render_mode: string;
  source_text: string;
  source_file_path: string;
  source_file_name: string;
  source_file_mime: string;
};

/** The resolved DB columns for a single assignment_sources row. */
export type SourceColumns = {
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  source_html: string | null;
  source_render_mode: "pdf" | "rich" | "plain" | "image" | null;
  source_file_path: string | null;
  source_file_name: string | null;
  source_file_mime: string | null;
};

/**
 * Parse the `sources` hidden input (a JSON array, like `rubric`). Narrative
 * mode omits it → []. Malformed JSON or non-array → []. Each element is
 * coerced to a SourceInput with string fields (missing keys become "").
 */
export function parseSources(formData: FormData): SourceInput[] {
  const raw = formData.get("sources");
  if (raw == null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return parsed.map((s): SourceInput => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      source_id: str(o.source_id),
      kind: o.kind === "secondary" ? "secondary" : "primary",
      source_title: str(o.source_title),
      source_author: str(o.source_author),
      source_citation: str(o.source_citation),
      source_url: str(o.source_url),
      source_html: str(o.source_html),
      source_render_mode: str(o.source_render_mode),
      source_text: str(o.source_text),
      source_file_path: str(o.source_file_path),
      source_file_name: str(o.source_file_name),
      source_file_mime: str(o.source_file_mime),
    };
  });
}

/**
 * Resolve one posted source into its DB columns, mirroring the render-mode
 * rules the single-source writer used:
 *   - rich:  sanitize posted HTML, then DERIVE source_text from it (the
 *            canonical annotation substrate — see lib/source-content.ts).
 *   - pdf:   store source_text verbatim (offset-stable).
 *   - plain: store the typed text (empty→null).
 */
export function resolveSourceColumns(src: SourceInput): SourceColumns {
  const mode = VALID_RENDER_MODES.has(src.source_render_mode)
    ? (src.source_render_mode as "pdf" | "rich" | "plain" | "image")
    : null;

  const shared = {
    source_title: emptyToNull(src.source_title),
    source_author: emptyToNull(src.source_author),
    source_citation: emptyToNull(src.source_citation),
    source_url: emptyToNull(src.source_url),
    source_file_path: emptyToNull(src.source_file_path),
    source_file_name: emptyToNull(src.source_file_name),
    source_file_mime: emptyToNull(src.source_file_mime),
  };

  if (mode === "rich" && src.source_html) {
    const sanitized = sanitizeSourceHtml(src.source_html);
    const substrate = sourceHtmlToSubstrate(sanitized);
    return {
      ...shared,
      source_html: emptyToNull(sanitized),
      source_text: substrate.trim() === "" ? null : substrate,
      source_render_mode: "rich",
    };
  }

  if (mode === "pdf") {
    return {
      ...shared,
      source_html: null,
      source_text: src.source_text.trim() === "" ? null : src.source_text,
      source_render_mode: "pdf",
    };
  }

  // image: the stored file IS the source. No substrate exists, so any posted
  // text/html is dropped — nothing may index offsets into a picture. A row
  // that lost its file falls through isEmptySource() unless it has metadata.
  if (mode === "image") {
    return {
      ...shared,
      source_html: null,
      source_text: null,
      source_render_mode: "image",
    };
  }

  const plainText = emptyToNull(src.source_text);
  return {
    ...shared,
    source_html: null,
    source_text: plainText,
    source_render_mode: mode ?? (plainText ? "plain" : null),
  };
}

/**
 * A source row is "empty" if it carries no body, no file, and no metadata —
 * an accidental blank repeater row. These are dropped before persisting.
 */
export function isEmptySource(c: SourceColumns): boolean {
  return (
    !c.source_text &&
    !c.source_html &&
    !c.source_file_path &&
    !c.source_title &&
    !c.source_author &&
    !c.source_citation &&
    !c.source_url
  );
}
