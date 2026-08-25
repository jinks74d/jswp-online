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

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { SourceTextViewer, type SelectionPayload } from "./source-text-viewer";
import { PdfSourceViewer } from "./pdf-source-viewer";
import { OpenOriginalButton } from "./open-original-button";
import { PrintSourceButton } from "./print/print-source-button";
import type { PrintSourceMeta } from "./print/print-source-plan";
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
import { useServerAction } from "@/hooks/use-server-action";
import { useWritingMode } from "./use-writing-mode";
import { SubmitStepButton } from "./submit-step-button";

export type AnnotateSource = {
  sourceId: string;
  kind: "primary" | "secondary";
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceFilePath: string | null;
  sourceFileName: string | null;
  sourceHtml: string | null;
  sourceRenderMode: "pdf" | "rich" | "plain" | "image" | null;
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
  const { isReadOnly, printMeta } = useWritingMode();
  // Aliased to the existing names so the render below is untouched.
  const { pending: continuing, error: continueError, run } = useServerAction();
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
    run(() => completeStepAndAdvance(writingId, stepKey));
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
          printMeta={printMeta}
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
            <SubmitStepButton writingId={writingId} stepKey={stepKey} />
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue || continuing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--brand)" }}
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
  printMeta,
  onUnannotatable,
}: {
  writingId: string;
  index: number;
  multiple: boolean;
  source: AnnotateSource;
  annotations: readonly TextAnnotationRow[];
  readOnly: boolean;
  /** Null on the teacher review surface — see writing-mode-provider.tsx. */
  printMeta: PrintSourceMeta | null;
  onUnannotatable: () => void;
}) {
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [openForm, setOpenForm] = useState<AnnotationFormPayload | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);

  /**
   * Full-screen "pop out" reading mode.
   *
   * This EXPANDS the pane in place — it does not mount a second copy of the
   * annotation surface inside a modal, which is the obvious implementation and
   * a broken one: PdfSourceViewer registers a `selectionchange` listener on
   * `document` (pdf-source-viewer.tsx), so two live instances of the same
   * source would both interpret every selection and race to open a popover.
   * Toggling classes on the existing <section> keeps exactly one instance, so
   * nothing remounts: no re-fetched signed URL, no pdf.js re-render, no lost
   * kind filters, no lost scroll position.
   */
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Move focus into the expanded view, and hand it back to whatever opened it
  // on the way out (WCAG 2.4.3 Focus Order).
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
        // Let the inner layers own Escape first: the annotation form and the
        // selection popover are dismissed before the reading view is, and the
        // PDF viewer consumes it to leave keyboard-selection mode (it calls
        // preventDefault, which is what defaultPrevented detects here).
        if (event.defaultPrevented) return;
        if (openForm || selection) return;
        event.preventDefault();
        setExpanded(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panel = sectionRef.current;
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
  }, [expanded, openForm, selection]);

  const isPdf =
    source.sourceRenderMode === "pdf" && Boolean(source.sourceFilePath);
  // An image source is the picture itself — no text layer, so nothing here is
  // annotatable and the pane reports that immediately (below) rather than
  // waiting on a viewer to discover it, the way the PDF pane does.
  const isImage = source.sourceRenderMode === "image";
  const needsFileUrl = isPdf || isImage;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);

  useEffect(() => {
    if (!needsFileUrl || !source.sourceFilePath) return;
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
  }, [needsFileUrl, writingId, source.sourceFilePath]);

  useEffect(() => {
    if (isImage) onUnannotatable();
    // onUnannotatable is idempotent (set-add guarded in the parent).
  }, [isImage, onUnannotatable]);

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

  // Names the dialog for screen readers, preferring the source's own title.
  const dialogLabel = source.sourceTitle?.trim() || heading || "Source";

  return (
    <section
      ref={sectionRef}
      // A full-bleed opaque panel IS the modal here, so there's no separate
      // backdrop element to stack against the popover and form (both of which
      // are `fixed z-50` and render inside this section).
      className={
        expanded
          ? // overflow-auto, not overflow-y-auto: a wide table in a rich source
            // still needs to be reachable sideways, and negative-left overflow
            // (the off-screen print sheet) never creates a scrollbar in LTR.
            "fixed inset-0 z-40 space-y-2 overflow-auto bg-white p-4 sm:p-6"
          : "space-y-2"
      }
      {...(expanded
        ? { role: "dialog", "aria-modal": true, "aria-label": dialogLabel }
        : {})}
    >
      {heading && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {heading}
        </h3>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2 min-w-0">
          <div
            className={
              expanded
                ? "sticky top-0 z-10 -mx-4 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 pb-3 sm:-mx-6 sm:px-6"
                : "flex items-start justify-between gap-3"
            }
          >
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
            <div className="ml-auto flex flex-wrap items-start justify-end gap-2">
              {source.sourceFilePath && (
                <OpenOriginalButton
                  writingId={writingId}
                  fileName={source.sourceFileName}
                  filePath={source.sourceFilePath}
                />
              )}
              {printMeta && (
                <PrintSourceButton
                  writingId={writingId}
                  source={source}
                  meta={printMeta}
                />
              )}
              <button
                ref={collapseButtonRef}
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={expanded}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-medium text-[var(--brand-contrast)] shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
              >
                {expanded ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {expanded ? "Exit full screen" : "Pop out"}
              </button>
            </div>
          </div>
          {annotations.length === 0 && !isImage && (
            <div className="text-xs text-gray-500 italic">
              Tip: select any word or phrase — or press “Tab” to move through
              the text and “Enter” on a word or phrase — to add your first
              annotation.
            </div>
          )}
          {isImage ? (
            <div className="space-y-2">
              {pdfUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element --
                   next/image can't optimize a private, short-lived signed URL. */
                <img
                  src={pdfUrl}
                  alt={source.sourceFileName ?? "Source image"}
                  className="max-w-full rounded-lg border border-gray-200 bg-white"
                />
              ) : pdfFailed ? (
                <p className="text-sm text-gray-600">
                  This image couldn&apos;t be loaded. Reload the page, or ask
                  your teacher to re-upload it.
                </p>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
                  Loading image…
                </div>
              )}
              <p className="text-xs text-gray-500 italic">
                This source is a picture, so there is no text to highlight —
                study it, then continue.
              </p>
            </div>
          ) : isPdf && !pdfFailed ? (
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

        {/* Popped out, the page header is gone and the pane's own sticky bar is
            the only thing above — so the sidebar tucks up under it. */}
        <aside
          className={
            expanded
              ? "lg:sticky lg:top-14 lg:self-start"
              : "lg:sticky lg:top-20 lg:self-start"
          }
        >
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
