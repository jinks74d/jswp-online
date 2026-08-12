"use client";

/**
 * [Print source] — the paper companion to [Open original] on Read & Annotate.
 * Gets the source text onto a sheet the student can mark up by hand with the
 * colored pens the program is taught with.
 *
 * Two behaviours, chosen by `printPathFor` (see print-source-plan.ts for why):
 *
 *   in_app   — pasted / .docx-derived text. We own the DOM, so we print our own
 *              clean sheet: double-spaced, wide annotation gutter, no
 *              highlights. This is the good path.
 *   original — PDFs and images. The file sits behind a cross-origin signed URL,
 *              which the same-origin policy forbids us from printing
 *              programmatically. We open it and hand off to the browser's own
 *              print — which also preserves the real page layout, so the
 *              student gets a better artifact than our text extraction.
 *
 * Renders nothing when there is nothing printable (an image with no file).
 */

import { useRef, useState, useTransition } from "react";
import { Loader2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { getWritingSourceUrlByPath } from "@/lib/actions/source-files";
import {
  SourcePrintSheet,
  SOURCE_PRINT_PAGE_STYLE,
} from "./source-print-sheet";
import {
  printPathFor,
  printDocumentTitle,
  type PrintSourceMeta,
  type SourceRenderMode,
} from "./print-source-plan";

/**
 * Structurally compatible with AnnotateSource / ReferenceSource — declared
 * locally rather than imported so this module doesn't depend on the annotate
 * client that renders it.
 */
export interface PrintableSource {
  readonly sourceTitle: string | null;
  readonly sourceAuthor: string | null;
  readonly sourceText: string;
  readonly sourceHtml: string | null;
  readonly sourceFilePath: string | null;
  readonly sourceRenderMode: SourceRenderMode;
}

export function PrintSourceButton({
  writingId,
  source,
  meta,
}: {
  writingId: string;
  source: PrintableSource;
  meta: PrintSourceMeta;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  const path = printPathFor(
    source.sourceRenderMode,
    !!source.sourceFilePath,
    source.sourceText.trim().length > 0
  );

  const printSheet = useReactToPrint({
    contentRef: sheetRef,
    documentTitle: printDocumentTitle(meta, source.sourceTitle),
    pageStyle: SOURCE_PRINT_PAGE_STYLE,
    onPrintError: () =>
      setError("Could not open the print dialog. Try again, or use Ctrl+P."),
  });

  if (path === "unavailable") return null;

  const openOriginalForPrinting = () => {
    setError(null);
    setHandedOff(false);
    start(async () => {
      const filePath = source.sourceFilePath;
      if (!filePath) {
        setError("No original file is attached.");
        return;
      }
      const res = await getWritingSourceUrlByPath(writingId, filePath);
      if (res.ok) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        setHandedOff(true);
      } else {
        setError(res.error);
      }
    });
  };

  const onClick = () => {
    if (path === "in_app") {
      setError(null);
      printSheet();
      return;
    }
    openOriginalForPrinting();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Print source
        </button>
        {error && (
          <span role="alert" className="text-xs text-red-700">
            {error}
          </span>
        )}
      </div>

      {/* The browser owns the print dialog on the cross-origin path, so say so
          rather than leaving the student wondering why nothing printed. */}
      {handedOff && !error && (
        <span role="status" className="text-xs text-gray-600">
          Opened in a new tab — print it from there (Ctrl+P, or ⌘P on a Mac).
        </span>
      )}

      {path === "in_app" && (
        /* Parked off-screen instead of display:none — react-to-print clones a
           mounted node, and a display:none subtree clones with no layout.
           SOURCE_PRINT_PAGE_STYLE undoes this positioning inside the iframe. */
        <div
          className="pointer-events-none absolute -left-[10000px] top-0 h-0 w-[7in] overflow-hidden"
          aria-hidden="true"
        >
          <div ref={sheetRef} className="jswp-print-host">
            <SourcePrintSheet
              meta={meta}
              sourceTitle={source.sourceTitle}
              sourceAuthor={source.sourceAuthor}
              sourceText={source.sourceText}
              sourceHtml={source.sourceHtml}
            />
          </div>
        </div>
      )}
    </div>
  );
}
