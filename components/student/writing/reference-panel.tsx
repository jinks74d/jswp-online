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

import { useEffect, useMemo, useState } from "react";
import { PopoutShell } from "./popout-shell";
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
  /**
   * Off when a step already wraps its whole working area in a PopoutShell —
   * gather-cds does. Two nested pop-out buttons, one expanding the source and
   * one expanding everything including the source, is a coin toss for the
   * student rather than a choice.
   */
  showPopout?: boolean;
}

export function ReferencePanel({
  writingId,
  sources,
  annotations,
  showPopout = true,
}: Props) {
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);


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

  const heading = (
    <div className="text-xs uppercase tracking-wide text-gray-500">
      Reference
    </div>
  );

  const body = (
    <>
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
    </>
  );

  // Without its own pop-out the panel is just its content — the step above is
  // providing the shell, and wrapping again would nest a second dialog.
  if (!showPopout) {
    return (
      <div className="space-y-4">
        {heading}
        {body}
      </div>
    );
  }

  return (
    <PopoutShell label="Source reference" heading={heading}>
      {() => body}
    </PopoutShell>
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
