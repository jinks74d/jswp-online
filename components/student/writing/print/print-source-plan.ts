/**
 * Pure decisions behind the "Print source" affordance on Read & Annotate.
 * Extracted from the button so the render-mode branching is unit testable
 * without dragging react-to-print (and its iframe/DOM assumptions) into
 * jsdom — same convention as the t-chart / elaboration compute-gates.
 *
 * Why the branch exists at all: the four `source_render_mode` values split
 * into two halves by who owns the pixels.
 *
 *   rich / plain  — the app owns the DOM. We render a clean print sheet from
 *                   the same substrate the student annotates against, so the
 *                   printout is ours to lay out (double-spaced, wide margin).
 *   pdf  / image  — the bytes live behind a short-lived Supabase signed URL on
 *                   a different origin. Same-origin policy blocks a
 *                   programmatic `iframe.contentWindow.print()`, so we can't
 *                   drive the print ourselves. Opening the file and letting
 *                   the student print from the browser is both the only
 *                   option and the better artifact — they get the real page
 *                   layout instead of our flattened text extraction.
 *
 * Tested in __tests__/lib/print-source-plan.test.ts.
 */

export type SourceRenderMode = "pdf" | "rich" | "plain" | "image" | null;

export type PrintPath =
  /** Render our own clean sheet and print it in-app. */
  | "in_app"
  /** Open the teacher's file; the student prints it from the browser. */
  | "original"
  /** Nothing printable — don't offer the affordance. */
  | "unavailable";

export interface PrintSourceMeta {
  readonly studentName: string;
  readonly assignmentTitle: string;
  /** Mode display name, e.g. "Expository / Informational". */
  readonly modeLabel: string;
  readonly draftNumber: number;
}

/**
 * Which print route a source takes.
 *
 * `hasText` guards the degenerate cases: a PDF whose text extraction came back
 * empty (scanned/image-only — the same condition the Continue gate treats as
 * unannotatable) has nothing for us to typeset, and an image never does. When
 * there is also no file to fall back on, there is nothing to print at all and
 * the caller should render no button rather than an empty sheet.
 */
export function printPathFor(
  renderMode: SourceRenderMode,
  hasFile: boolean,
  hasText: boolean
): PrintPath {
  if (renderMode === "image") {
    return hasFile ? "original" : "unavailable";
  }
  if (renderMode === "pdf") {
    if (hasFile) return "original";
    return hasText ? "in_app" : "unavailable";
  }
  // rich / plain / null (legacy rows predate the column) — ours to typeset.
  if (hasText) return "in_app";
  return hasFile ? "original" : "unavailable";
}

/**
 * Filename the browser proposes when the student picks "Save as PDF", and the
 * title the print dialog shows. Prefers the source's own title so a printed
 * passage is identifiable on its own; falls back to the assignment.
 */
export function printDocumentTitle(
  meta: PrintSourceMeta,
  sourceTitle: string | null
): string {
  const subject = sourceTitle?.trim() || meta.assignmentTitle.trim();
  const who = meta.studentName.trim();
  return who ? `${subject} — ${who}` : subject;
}

/**
 * The two header lines on the printed sheet (CLAUDE.md §10: student name,
 * assignment title, date, draft number). Draft is named only past the first
 * one — "Draft 1" on every early printout is noise.
 */
export function printHeaderLines(
  meta: PrintSourceMeta,
  printedOn: string
): readonly [string, string] {
  const identity = [meta.studentName.trim(), meta.assignmentTitle.trim()]
    .filter(Boolean)
    .join(" · ");

  const provenance = [
    meta.modeLabel.trim(),
    printedOn ? `printed ${printedOn}` : "",
    meta.draftNumber > 1 ? `Draft ${meta.draftNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return [identity, provenance];
}
