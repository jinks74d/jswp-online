"use client";

/**
 * Read-only reference: every attached source with the student's annotations
 * highlighted (each source rendered against its own substrate, annotations
 * partitioned by source_id), plus a compact per-kind list. Shared by the
 * t-chart, gather-cds, cm-dev, decisions, elaboration, and topic-sentence-dev
 * steps to keep the sources + annotations visible while working downstream.
 *
 * One kind filter governs all sources. Clicking a list entry scrolls its
 * source viewer to that annotation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { SourceTextViewer } from "./source-text-viewer";
import { PdfSourceViewer } from "./pdf-source-viewer";
import { OpenOriginalButton } from "./open-original-button";
import { getWritingSourceUrlByPath } from "@/lib/actions/source-files";
import {
  ANNOTATION_KINDS,
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "./annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

export type ReferenceSource = {
  sourceId: string;
  kind: "primary" | "secondary";
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceFilePath: string | null;
  sourceFileName: string | null;
  sourceHtml: string | null;
  /** 'image' sources have no substrate — they render as the picture itself. */
  sourceRenderMode: "pdf" | "rich" | "plain" | "image" | null;
};

interface Props {
  writingId: string;
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

export function ReferencePanel({ writingId, sources, annotations }: Props) {
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);

  /*
   * Pop-out, mirroring Read & Annotate's reading view.
   *
   * The reference column is narrow by design — it sits beside the step's own
   * work area — which is fine for glancing at a highlight and cramped for
   * actually re-reading the source. Expanding makes it the whole screen
   * without unmounting anything, so kind filters and scroll position survive
   * the toggle.
   *
   * NOTE: this repeats the shell in annotate-text-client.tsx (focus handoff,
   * scroll lock, Escape, Tab trap). Left duplicated rather than extracted
   * because that file's Escape handling is entangled with its annotation form
   * and selection popover, which have no equivalent here — see BACKLOG.
   */
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus moves in on open and returns to the opener on close (WCAG 2.4.3).
  useEffect(() => {
    if (!expanded) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    collapseButtonRef.current?.focus();
    return () => previouslyFocusedRef.current?.focus();
  }, [expanded]);

  // The page behind must not scroll while the overlay is up.
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  // Escape closes; Tab is trapped inside the overlay.
  useEffect(() => {
    if (!expanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The PDF viewer consumes Escape to leave keyboard-selection mode and
        // calls preventDefault; let it win rather than closing out from under
        // a student who was only trying to drop a selection.
        if (event.defaultPrevented) return;
        event.preventDefault();
        setExpanded(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  // Partition annotations by source. Legacy rows (source_id null) fall under
  // the first source so pre-migration writings still render.
  const bySource = useMemo(() => {
    const map = new Map<string, TextAnnotationRow[]>();
    const firstId = sources[0]?.sourceId ?? null;
    for (const a of annotations) {
      const key = a.source_id ?? firstId;
      if (key == null) continue;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [annotations, sources]);

  const toggleKind = (k: AnnotationKind) => {
    setVisibleKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const onSelectAnnotation = (a: TextAnnotationRow) => {
    setScrollTargetId(a.id);
    setTimeout(() => setScrollTargetId(null), 800);
  };

  const multiple = sources.length > 1;

  return (
    <section
      ref={panelRef}
      className={
        expanded
          ? // overflow-auto, not overflow-y-auto: a wide table in a rich
            // source still needs to be reachable sideways.
            "fixed inset-0 z-40 space-y-4 overflow-auto bg-white p-4 sm:p-6"
          : "space-y-4"
      }
      {...(expanded
        ? { role: "dialog", "aria-modal": true, "aria-label": "Source reference" }
        : {})}
    >
      <div
        className={
          expanded
            ? "sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 pb-3 sm:-mx-6 sm:px-6"
            : "flex items-center justify-between gap-3"
        }
      >
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Reference
        </div>
        <button
          ref={collapseButtonRef}
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {expanded ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {expanded ? "Exit full screen" : "Pop out"}
        </button>
      </div>

      {/* Shared kind filter, counts across all sources. */}
      {annotations.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-2">
          <div className="text-xs uppercase tracking-wide text-gray-500 px-1 mb-1">
            Show
          </div>
          {ANNOTATION_KIND_ORDER.map((k) => {
            const cfg = ANNOTATION_KINDS[k];
            const count = annotations.filter((a) => a.kind === k).length;
            if (count === 0) return null;
            return (
              <label
                key={k}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleKinds.has(k)}
                  onChange={() => toggleKind(k)}
                  className="rounded border-gray-400"
                />
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dotBg}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-gray-800">{cfg.label}</span>
                <span className="text-xs text-gray-500">{count}</span>
              </label>
            );
          })}
        </section>
      )}

      {sources.map((source, idx) => {
        const anns = bySource.get(source.sourceId) ?? [];
        return (
          <div key={source.sourceId} className="space-y-2">
            <header className="space-y-1.5">
              {multiple && (
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {`Source ${idx + 1}${source.kind === "secondary" ? " · Secondary" : " · Primary"}`}
                </div>
              )}
              {(source.sourceTitle || source.sourceAuthor) && (
                <div className="text-sm">
                  {source.sourceTitle && (
                    <span className="font-medium text-gray-800">
                      {source.sourceTitle}
                    </span>
                  )}
                  {source.sourceTitle && source.sourceAuthor && " · "}
                  {source.sourceAuthor && (
                    <span className="text-gray-700">{source.sourceAuthor}</span>
                  )}
                </div>
              )}
              {source.sourceFilePath && (
                <OpenOriginalButton
                  writingId={writingId}
                  fileName={source.sourceFileName}
                  filePath={source.sourceFilePath}
                />
              )}
            </header>

            {source.sourceRenderMode === "image" ? (
              // No substrate to highlight — show the picture, which is the
              // whole source. Without this the panel would render blank.
              <ReferenceImage
                writingId={writingId}
                filePath={source.sourceFilePath}
                fileName={source.sourceFileName}
              />
            ) : source.sourceRenderMode === "pdf" && source.sourceFilePath ? (
              // Same viewer Read & Annotate uses. Without this branch a PDF
              // source fell through to SourceTextViewer, so the student saw
              // the real document while annotating and a flat wall of
              // extracted text on every step afterwards — same words, none of
              // the line breaks, columns or paragraph numbering they had just
              // been reading against.
              <ReferencePdf
                writingId={writingId}
                filePath={source.sourceFilePath}
                sourceText={source.sourceText}
                sourceHtml={source.sourceHtml}
                annotations={anns}
                visibleKinds={visibleKinds}
                scrollToAnnotationId={scrollTargetId}
              />
            ) : (
              <SourceTextViewer
                sourceText={source.sourceText}
                sourceHtml={source.sourceHtml}
                annotations={anns}
                visibleKinds={visibleKinds}
                scrollToAnnotationId={scrollTargetId}
                readOnly
              />
            )}

            {anns.length > 0 && (
              <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {ANNOTATION_KIND_ORDER.map((k) => {
                  const items = anns.filter((a) => a.kind === k);
                  if (items.length === 0 || !visibleKinds.has(k)) return null;
                  const cfg = ANNOTATION_KINDS[k];
                  return (
                    <div key={k}>
                      <div
                        className={`px-3 py-1.5 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide flex items-center gap-2 ${cfg.accentText}`}
                      >
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${cfg.dotBg}`}
                          aria-hidden="true"
                        />
                        {cfg.label}
                      </div>
                      <ul>
                        {items.map((a) => (
                          <li
                            key={a.id}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectAnnotation(a)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            >
                              <div className="text-xs text-gray-900 line-clamp-2">
                                {a.selected_text}
                              </div>
                              {a.note && (
                                <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                                  {a.note}
                                </div>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * An image source in the reference panel. The bucket is private, so the <img>
 * src is a signed URL minted on mount through the same membership-checked
 * server action "Open original" uses. Nothing here is annotatable — the panel
 * is read-only reference, and an image carries no offsets.
 */
/**
 * A PDF source, read-only, rendered the way Read & Annotate renders it.
 *
 * Holds its own URL + failure state because the panel maps over many sources
 * and each needs its own signed URL — the same reason ReferenceImage does.
 *
 * Falls back to SourceTextViewer if the PDF will not load, mirroring
 * annotate-text-client's `pdfFailed` path. Flat text is a worse reading
 * experience but it is the same words; a broken viewer would be nothing.
 */
function ReferencePdf({
  writingId,
  filePath,
  sourceText,
  sourceHtml,
  annotations,
  visibleKinds,
  scrollToAnnotationId,
}: {
  writingId: string;
  filePath: string;
  sourceText: string;
  sourceHtml: string | null;
  annotations: readonly TextAnnotationRow[];
  visibleKinds: ReadonlySet<AnnotationKind>;
  scrollToAnnotationId: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getWritingSourceUrlByPath(writingId, filePath).then((res) => {
      if (!active) return;
      if (res.ok) setUrl(res.url);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [writingId, filePath]);

  if (failed) {
    return (
      <SourceTextViewer
        sourceText={sourceText}
        sourceHtml={sourceHtml}
        annotations={annotations}
        visibleKinds={visibleKinds}
        scrollToAnnotationId={scrollToAnnotationId}
        readOnly
      />
    );
  }
  if (!url) {
    return <p className="text-sm text-gray-500">Preparing PDF…</p>;
  }
  return (
    <PdfSourceViewer
      fileUrl={url}
      sourceText={sourceText}
      annotations={annotations}
      visibleKinds={visibleKinds}
      scrollToAnnotationId={scrollToAnnotationId}
      readOnly
      onLoadError={() => setFailed(true)}
    />
  );
}

function ReferenceImage({
  writingId,
  filePath,
  fileName,
}: {
  writingId: string;
  filePath: string | null;
  fileName: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setFailed(true);
      return;
    }
    let active = true;
    getWritingSourceUrlByPath(writingId, filePath).then((res) => {
      if (!active) return;
      if (res.ok) setUrl(res.url);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [writingId, filePath]);

  if (failed) {
    return (
      <p className="text-sm text-gray-600">
        This image couldn&apos;t be loaded. Reload the page to try again.
      </p>
    );
  }
  if (!url) {
    return <p className="text-sm text-gray-500">Loading image…</p>;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       next/image can't optimize a private, short-lived signed URL. */
    <img
      src={url}
      alt={fileName ?? "Source image"}
      className="max-w-full rounded-lg border border-gray-200 bg-white"
    />
  );
}
