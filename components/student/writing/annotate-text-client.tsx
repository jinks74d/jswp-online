"use client";

/**
 * Read-and-Annotate orchestrator for MULTI-SOURCE assignments.
 *
 *   AnnotateTextClient  — step-level shell. Owns the [Continue] gate (which
 *                         counts annotations across every source) and renders
 *                         one SourceAnnotatePane per attached source.
 *   SourceAnnotatePane  — per-source viewer + selection popover + create/edit
 *                         form + sidebar, scoped to ONE source's substrate and
 *                         its own annotation subset. New annotations carry that
 *                         source's id.
 *
 * Annotations are NOT held in local state — they come down as a prop and
 * refresh via revalidatePath after each server-action round-trip (no
 * optimistic UI, per chunk 4.3).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SourceTextViewer, type SelectionPayload } from "./source-text-viewer";
import { PdfSourceViewer } from "./pdf-source-viewer";
import { OpenOriginalButton } from "./open-original-button";
import { getWritingSourceUrlByPath } from "@/lib/actions/source-files";
import { AnnotationPopover } from "./annotation-popover";
import {
  AnnotationForm,
  type AnnotationFormPayload,
} from "./annotation-form";
import { AnnotationSidebar } from "./annotation-sidebar";
import {
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "./annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "./use-writing-mode";

export type AnnotateSource = {
  sourceId: string;
  kind: "primary" | "secondary";
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceFilePath: string | null;
  sourceFileName: string | null;
  sourceHtml: string | null;
  sourceRenderMode: "pdf" | "rich" | "plain" | null;
};

interface Props {
  writingId: string;
  stepKey: string;
  required: boolean;
  sources: readonly AnnotateSource[];
  initialAnnotations: readonly TextAnnotationRow[];
}

export function AnnotateTextClient({
  writingId,
  stepKey,
  required,
  sources,
  initialAnnotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [continuing, startContinue] = useTransition();
  const [continueError, setContinueError] = useState<string | null>(null);
  // Sources whose file is a scanned/image-only PDF with no selectable text —
  // reported up by each pane so the Continue gate never traps a student on a
  // file they can't highlight.
  const [unannotatable, setUnannotatable] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const onUnannotatable = (sourceId: string) =>
    setUnannotatable((prev) => {
      if (prev.has(sourceId)) return prev;
      const next = new Set(prev);
      next.add(sourceId);
      return next;
    });

  // Group annotations by source. Legacy rows (source_id === null) fall under
  // the first source so pre-migration writings still render.
  const bySource = useMemo(() => {
    const map = new Map<string, TextAnnotationRow[]>();
    const firstId = sources[0]?.sourceId ?? null;
    for (const a of initialAnnotations) {
      const key = a.source_id ?? firstId;
      if (key == null) continue;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [initialAnnotations, sources]);

  const total = initialAnnotations.length;
  const hasAnnotations = total >= 1;
  const allUnannotatable =
    sources.length > 0 && unannotatable.size >= sources.length;
  const canContinue = !required || hasAnnotations || allUnannotatable;

  const onContinue = () => {
    setContinueError(null);
    startContinue(async () => {
      try {
        await completeStepAndAdvance(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        setContinueError(msg || "Could not continue.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {sources.map((source, idx) => (
        <SourceAnnotatePane
          key={source.sourceId}
          writingId={writingId}
          index={idx}
          multiple={sources.length > 1}
          source={source}
          annotations={bySource.get(source.sourceId) ?? []}
          readOnly={isReadOnly}
          onUnannotatable={() => onUnannotatable(source.sourceId)}
        />
      ))}

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {hasAnnotations
              ? `${total} annotation${total === 1 ? "" : "s"} saved`
              : allUnannotatable
                ? "These files can’t be highlighted — read them, then continue."
                : required
                  ? "Add at least one annotation to continue."
                  : "Annotating is optional — add notes if they help, or continue."}
          </div>
          <div className="flex items-center gap-3">
            {continueError && (
              <div className="text-sm text-red-700" role="alert">
                {continueError}
              </div>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue || continuing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {continuing && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              {continuing ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Per-source pane ────────────────────────────────────────────────── */

function SourceAnnotatePane({
  writingId,
  index,
  multiple,
  source,
  annotations,
  readOnly,
  onUnannotatable,
}: {
  writingId: string;
  index: number;
  multiple: boolean;
  source: AnnotateSource;
  annotations: readonly TextAnnotationRow[];
  readOnly: boolean;
  onUnannotatable: () => void;
}) {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [openForm, setOpenForm] = useState<AnnotationFormPayload | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);

  const isPdf =
    source.sourceRenderMode === "pdf" && Boolean(source.sourceFilePath);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);

  useEffect(() => {
    if (!isPdf || !source.sourceFilePath) return;
    let active = true;
    (async () => {
      const res = await getWritingSourceUrlByPath(
        writingId,
        source.sourceFilePath!
      );
      if (!active) return;
      if (res.ok) setPdfUrl(res.url);
      else setPdfFailed(true);
    })();
    return () => {
      active = false;
    };
  }, [isPdf, writingId, source.sourceFilePath]);

  const onAnnotateClick = () => {
    if (!selection) return;
    setOpenForm({
      mode: "create",
      writingId,
      sourceId: source.sourceId,
      rangeStart: selection.rangeStart,
      rangeEnd: selection.rangeEnd,
      selectedText: selection.selectedText,
    });
    setSelection(null);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  };

  const onAnnotationClick = (annotation: TextAnnotationRow) => {
    setOpenForm({ mode: "edit", writingId, annotation });
    setSelection(null);
  };

  // Keyboard-only creation path (WCAG 2.1.1).
  const onCreateRange = (
    rangeStart: number,
    rangeEnd: number,
    selectedText: string
  ) => {
    setOpenForm({
      mode: "create",
      writingId,
      sourceId: source.sourceId,
      rangeStart,
      rangeEnd,
      selectedText,
    });
    setSelection(null);
  };

  const toggleKind = (kind: AnnotationKind) => {
    setVisibleKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const onSelectAnnotation = (annotation: TextAnnotationRow) => {
    setScrollTargetId(annotation.id);
    setTimeout(() => setScrollTargetId(null), 800);
  };

  const heading = multiple
    ? `Source ${index + 1}${source.kind === "secondary" ? " · Secondary" : " · Primary"}`
    : null;

  return (
    <section className="space-y-2">
      {heading && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {heading}
        </h3>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {(source.sourceTitle || source.sourceAuthor) && (
              <div className="text-sm text-gray-600">
                {source.sourceTitle && (
                  <span className="font-medium text-gray-800">
                    {source.sourceTitle}
                  </span>
                )}
                {source.sourceTitle && source.sourceAuthor && " · "}
                {source.sourceAuthor && <span>{source.sourceAuthor}</span>}
              </div>
            )}
            {source.sourceFilePath && (
              <OpenOriginalButton
                writingId={writingId}
                fileName={source.sourceFileName}
                filePath={source.sourceFilePath}
              />
            )}
          </div>
          {annotations.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              Tip: select any word or phrase — or press “Tab” to move through
              the text and “Enter” on a word or phrase — to add your first
              annotation.
            </div>
          )}
          {isPdf && !pdfFailed ? (
            pdfUrl ? (
              <PdfSourceViewer
                fileUrl={pdfUrl}
                sourceText={source.sourceText}
                annotations={annotations}
                visibleKinds={visibleKinds}
                scrollToAnnotationId={scrollTargetId}
                onSelection={readOnly ? () => {} : setSelection}
                onClearSelection={() => setSelection(null)}
                onAnnotationClick={onAnnotationClick}
                readOnly={readOnly}
                onLoadError={() => setPdfFailed(true)}
                onUnannotatable={onUnannotatable}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
                Preparing PDF…
              </div>
            )
          ) : (
            <SourceTextViewer
              sourceText={source.sourceText}
              sourceHtml={source.sourceHtml}
              annotations={annotations}
              visibleKinds={visibleKinds}
              scrollToAnnotationId={scrollTargetId}
              onSelection={readOnly ? () => {} : setSelection}
              onClearSelection={() => setSelection(null)}
              onAnnotationClick={onAnnotationClick}
              onCreateRange={readOnly ? undefined : onCreateRange}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AnnotationSidebar
            annotations={annotations}
            visibleKinds={visibleKinds}
            onToggleKind={toggleKind}
            onSelectAnnotation={onSelectAnnotation}
          />
        </aside>
      </div>

      {selection && !openForm && !readOnly && (
        <AnnotationPopover
          rect={selection.rect}
          onAnnotate={onAnnotateClick}
          onDismiss={() => setSelection(null)}
        />
      )}

      {openForm && (
        <AnnotationForm payload={openForm} onClose={() => setOpenForm(null)} />
      )}
    </section>
  );
}
