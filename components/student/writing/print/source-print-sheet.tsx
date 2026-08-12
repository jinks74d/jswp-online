"use client";

/**
 * The paper artifact behind [Print source] on Read & Annotate: the source text
 * exactly as the teacher supplied it, with none of the student's annotations.
 *
 * Deliberately clean. The printed guides have students underline concrete
 * detail in red and write notes in the margin *by hand* — this sheet is the
 * paper they do that on, so it carries no highlights and no legend. (Printing
 * an already-annotated copy is a different artifact; see docs/BACKLOG.md.)
 *
 * Two layout choices follow from that use:
 *   * the body is double-spaced, leaving room to underline between lines;
 *   * @page keeps a wide right margin, because the Expository step's own hint
 *     tells the student "notes in the margin help you to find concrete detail
 *     later" — so the margin has to be wide enough to write in.
 *
 * Lives in the DOM (off-screen) rather than being conjured at print time:
 * react-to-print clones a mounted node, so `contentRef` must resolve.
 */

import { useEffect, useMemo, useState } from "react";
import { buildRichTree } from "../rich-source-tree";
import { RichSourceBody } from "../rich-source-body";
import { printHeaderLines, type PrintSourceMeta } from "./print-source-plan";

/**
 * Injected into react-to-print's iframe. Two jobs: set up the page box, and
 * undo the off-screen parking that hides the sheet on screen (the wrapper's
 * classes are cloned along with it, so without this reset the printed page
 * would be positioned 10000px to the left and come out blank).
 */
export const SOURCE_PRINT_PAGE_STYLE = `
  @page {
    size: letter portrait;
    /* top right bottom left — the fat right margin is the annotation gutter. */
    margin: 0.75in 1.75in 0.75in 0.75in;
  }
  .jswp-print-host {
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  /* Keep the teacher's own formatting legible on paper. */
  .jswp-print-body { line-height: 2; font-size: 12pt; color: #000; }
  .jswp-print-body p { margin: 0 0 0.9em; }
  .jswp-print-body h1,
  .jswp-print-body h2,
  .jswp-print-body h3 { line-height: 1.4; margin: 1.2em 0 0.5em; }
  .jswp-print-body img { max-width: 100%; }
  .jswp-print-body blockquote {
    margin: 0 0 0.9em 0.5in;
    font-style: italic;
  }
  .jswp-print-body table { border-collapse: collapse; }
  .jswp-print-body td,
  .jswp-print-body th { border: 1px solid #000; padding: 4px 6px; }
`;

export interface SourcePrintSheetProps {
  readonly meta: PrintSourceMeta;
  readonly sourceTitle: string | null;
  readonly sourceAuthor: string | null;
  readonly sourceText: string;
  readonly sourceHtml: string | null;
}

export function SourcePrintSheet({
  meta,
  sourceTitle,
  sourceAuthor,
  sourceText,
  sourceHtml,
}: SourcePrintSheetProps) {
  // buildRichTree needs DOMParser, and the printed date must not be baked into
  // the server render (it would both mismatch on hydration and go stale in a
  // tab left open). Both wait for mount — by print time we are always mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const printedOn = useMemo(
    () =>
      mounted
        ? new Date().toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "",
    [mounted]
  );

  const isRich = typeof sourceHtml === "string" && sourceHtml.length > 0;
  const richNodes = useMemo(
    () =>
      mounted && isRich
        ? // No annotations and no visible kinds: every run comes back unmarked,
          // so renderMark below is never reached.
          buildRichTree(sourceHtml as string, [], new Set())
        : null,
    [mounted, isRich, sourceHtml]
  );

  const [identityLine, provenanceLine] = printHeaderLines(meta, printedOn);

  return (
    <div className="jswp-print-body">
      <header className="mb-6 border-b border-black pb-2">
        <div className="text-[11pt] font-semibold leading-snug">
          {identityLine}
        </div>
        <div className="text-[9pt] leading-snug">{provenanceLine}</div>
      </header>

      {(sourceTitle || sourceAuthor) && (
        <div className="mb-4">
          {sourceTitle && (
            <div className="text-[14pt] font-bold leading-tight">
              {sourceTitle}
            </div>
          )}
          {sourceAuthor && (
            <div className="text-[11pt] italic leading-tight">
              by {sourceAuthor}
            </div>
          )}
        </div>
      )}

      {richNodes ? (
        <RichSourceBody nodes={richNodes} renderMark={renderNothing} />
      ) : (
        <div className="whitespace-pre-wrap">{sourceText}</div>
      )}
    </div>
  );
}

/**
 * Required by RichSourceBody's contract but unreachable here: the tree is
 * built with zero annotations, so no run is ever marked.
 */
function renderNothing(): null {
  return null;
}
