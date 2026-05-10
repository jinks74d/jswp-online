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

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SourceTextViewer, type SelectionPayload } from "./source-text-viewer";
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
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  initialAnnotations: readonly TextAnnotationRow[];
}

export function AnnotateTextClient({
  writingId,
  stepKey,
  sourceText,
  sourceTitle,
  sourceAuthor,
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

  const canContinue = initialAnnotations.length >= 1;

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
          {(sourceTitle || sourceAuthor) && (
            <div className="text-sm text-gray-600">
              {sourceTitle && (
                <span className="font-medium text-gray-800">{sourceTitle}</span>
              )}
              {sourceTitle && sourceAuthor && " · "}
              {sourceAuthor && <span>{sourceAuthor}</span>}
            </div>
          )}
          {initialAnnotations.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              Tip: select any passage to add your first annotation.
            </div>
          )}
          <SourceTextViewer
            sourceText={sourceText}
            annotations={initialAnnotations}
            visibleKinds={visibleKinds}
            scrollToAnnotationId={scrollTargetId}
            onSelection={isReadOnly ? () => {} : setSelection}
            onClearSelection={() => setSelection(null)}
            onAnnotationClick={onAnnotationClick}
          />
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
            {canContinue
              ? `${initialAnnotations.length} annotation${initialAnnotations.length === 1 ? "" : "s"} saved`
              : "Add at least one annotation to continue."}
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
              {continuing && <Loader2 className="w-4 h-4 animate-spin" />}
              {continuing ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
