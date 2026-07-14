"use client";

/**
 * Orchestrates the Read-and-Annotate UI: source text viewer, selection
 * popover, create/edit form, sidebar list, and the [Continue] gate.
 *
 * State held here:
 *   - selection         — current text selection (drives the popover)
 *   - openForm          — null | create payload | edit payload
 *   - visibleKinds      — sidebar checkboxes; controls highlight rendering
 *   - scrollTargetId    — annotation id to bring into view (one-shot)
 *
 * Annotations themselves are NOT held in local state — they come down
 * as a prop and refresh via revalidatePath after each server-action
 * round-trip. Per chunk 4.3 spec: no optimistic UI.
 */

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SourceTextViewer, type SelectionPayload } from "./source-text-viewer";
import { PdfSourceViewer } from "./pdf-source-viewer";
import { OpenOriginalButton } from "./open-original-button";
import { getWritingSourceUrl } from "@/lib/actions/source-files";
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

interface Props {
  writingId: string;
  stepKey: string;
  required: boolean;
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceFilePath: string | null;
  sourceFileName: string | null;
  sourceHtml: string | null;
  sourceRenderMode: "pdf" | "rich" | "plain" | null;
  initialAnnotations: readonly TextAnnotationRow[];
}

export function AnnotateTextClient({
  writingId,
  stepKey,
  required,
  sourceText,
  sourceTitle,
  sourceAuthor,
  sourceFilePath,
  sourceFileName,
  sourceHtml,
  sourceRenderMode,
  initialAnnotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [openForm, setOpenForm] = useState<AnnotationFormPayload | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [continuing, startContinue] = useTransition();
  const [continueError, setContinueError] = useState<string | null>(null);

  // PDF-native annotate: render the original file faithfully (canvas + text
  // layer) instead of flat text. We mint the signed URL on demand (like
  // OpenOriginalButton) rather than embed a stale one. If minting fails, fall
  // back to the flat SourceTextViewer over the same source_text — annotation
  // offsets stay valid either way. (pdf.js load failures degrade inside the
  // viewer; Phase 6 hardens the rest.)
  const isPdf = sourceRenderMode === "pdf" && Boolean(sourceFilePath);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  // A scanned/image-only PDF renders but has no selectable text, so it can't be
  // annotated. We must not let a teacher's bad file trap a student on a
  // required-annotate step, so this relaxes the Continue gate below.
  const [pdfUnannotatable, setPdfUnannotatable] = useState(false);

  useEffect(() => {
    if (!isPdf) return;
    let active = true;
    (async () => {
      const res = await getWritingSourceUrl(writingId);
      if (!active) return;
      if (res.ok) setPdfUrl(res.url);
      else setPdfFailed(true);
    })();
    return () => {
      active = false;
    };
  }, [isPdf, writingId]);

  const onAnnotateClick = () => {
    if (!selection) return;
    setOpenForm({
      mode: "create",
      writingId,
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

  // Keyboard-only creation path (WCAG 2.1.1): a sentence target in the viewer
  // opens the create form directly with that sentence's range, bypassing the
  // mouse-drag selection + popover flow.
  const onCreateRange = (
    rangeStart: number,
    rangeEnd: number,
    selectedText: string
  ) => {
    setOpenForm({ mode: "create", writingId, rangeStart, rangeEnd, selectedText });
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
    // Reset after a tick so the same annotation can be re-targeted later.
    setTimeout(() => setScrollTargetId(null), 800);
  };

  // When the step is required (e.g. Literary), at least one annotation is
  // needed to advance. When optional (Expository, Argumentation), the
  // student may continue without annotating. Flag comes from the step
  // config in lib/jswp-modes.ts.
  const hasAnnotations = initialAnnotations.length >= 1;
  // A required step normally needs ≥1 annotation, but a scanned/unannotatable
  // PDF can't be highlighted at all — never trap the student on a file they
  // can't act on.
  const canContinue = !required || hasAnnotations || pdfUnannotatable;

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
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {(sourceTitle || sourceAuthor) && (
              <div className="text-sm text-gray-600">
                {sourceTitle && (
                  <span className="font-medium text-gray-800">{sourceTitle}</span>
                )}
                {sourceTitle && sourceAuthor && " · "}
                {sourceAuthor && <span>{sourceAuthor}</span>}
              </div>
            )}
            {sourceFilePath && (
              <OpenOriginalButton
                writingId={writingId}
                fileName={sourceFileName}
              />
            )}
          </div>
          {initialAnnotations.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              Tip: select any passage with the mouse — or press Tab to move
              through the text and Enter on a sentence — to add your first
              annotation.
            </div>
          )}
          {isPdf && !pdfFailed ? (
            pdfUrl ? (
              <PdfSourceViewer
                fileUrl={pdfUrl}
                sourceText={sourceText}
                annotations={initialAnnotations}
                visibleKinds={visibleKinds}
                scrollToAnnotationId={scrollTargetId}
                onSelection={isReadOnly ? () => {} : setSelection}
                onClearSelection={() => setSelection(null)}
                onAnnotationClick={onAnnotationClick}
                readOnly={isReadOnly}
                onLoadError={() => setPdfFailed(true)}
                onUnannotatable={() => setPdfUnannotatable(true)}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparing PDF…
              </div>
            )
          ) : (
            <SourceTextViewer
              sourceText={sourceText}
              sourceHtml={sourceHtml}
              annotations={initialAnnotations}
              visibleKinds={visibleKinds}
              scrollToAnnotationId={scrollTargetId}
              onSelection={isReadOnly ? () => {} : setSelection}
              onClearSelection={() => setSelection(null)}
              onAnnotationClick={onAnnotationClick}
              onCreateRange={isReadOnly ? undefined : onCreateRange}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AnnotationSidebar
            annotations={initialAnnotations}
            visibleKinds={visibleKinds}
            onToggleKind={toggleKind}
            onSelectAnnotation={onSelectAnnotation}
          />
        </aside>
      </div>

      {selection && !openForm && !isReadOnly && (
        <AnnotationPopover
          rect={selection.rect}
          onAnnotate={onAnnotateClick}
          onDismiss={() => setSelection(null)}
        />
      )}

      {openForm && (
        <AnnotationForm
          payload={openForm}
          onClose={() => setOpenForm(null)}
        />
      )}

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {hasAnnotations
              ? `${initialAnnotations.length} annotation${initialAnnotations.length === 1 ? "" : "s"} saved`
              : pdfUnannotatable
                ? "This PDF can’t be highlighted — read it, then continue."
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
              {continuing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {continuing ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
