"use client";

/**
 * Modal form for creating + editing annotations. Two modes:
 *
 *   create:  Show the selected snippet (read-only at top), kind dropdown
 *            (default 'cd'), optional note. [Save] / [Cancel].
 *
 *   edit:    Show the existing snippet (read-only). Kind + note are
 *            pre-filled and editable. [Save] / [Cancel] / [Delete].
 *            Range columns are immutable per migrations/0001 and the
 *            server-side updateAnnotation contract.
 *
 * Submission round-trips a server action; on success the parent closes
 * the form and revalidatePath refreshes the data.
 */

import { useState, useTransition } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import {
  ANNOTATION_KINDS,
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "./annotation-kind-config";
import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "@/lib/actions/text-annotations";
import { useWritingMode } from "./use-writing-mode";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

export type AnnotationFormPayload =
  | {
      mode: "create";
      writingId: string;
      rangeStart: number;
      rangeEnd: number;
      selectedText: string;
    }
  | {
      mode: "edit";
      writingId: string;
      annotation: TextAnnotationRow;
    };

interface Props {
  payload: AnnotationFormPayload;
  onClose: () => void;
}

export function AnnotationForm({ payload, onClose }: Props) {
  const { isReadOnly } = useWritingMode();
  const initialKind: AnnotationKind =
    payload.mode === "edit" ? payload.annotation.kind : "cd";
  const initialNote =
    payload.mode === "edit" ? (payload.annotation.note ?? "") : "";
  const snippet =
    payload.mode === "edit"
      ? payload.annotation.selected_text
      : payload.selectedText;

  const [kind, setKind] = useState<AnnotationKind>(initialKind);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (payload.mode === "create") {
          await createAnnotation({
            writingId: payload.writingId,
            rangeStart: payload.rangeStart,
            rangeEnd: payload.rangeEnd,
            selectedText: payload.selectedText,
            kind,
            note: note.trim() || null,
          });
        } else {
          await updateAnnotation({
            annotationId: payload.annotation.id,
            writingId: payload.writingId,
            kind,
            note: note.trim() || null,
          });
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  };

  const onDelete = () => {
    if (payload.mode !== "edit") return;
    setError(null);
    startDeleting(async () => {
      try {
        await deleteAnnotation(payload.annotation.id, payload.writingId);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete.");
      }
    });
  };

  const isCreate = payload.mode === "create";
  const busy = pending || deleting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="annotation-form-title"
      onMouseDown={(e) => {
        // Backdrop click closes; clicks inside the panel should not.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2
            id="annotation-form-title"
            className="text-base font-semibold text-gray-900"
          >
            {isCreate ? "New annotation" : "Edit annotation"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-gray-500 hover:text-gray-900 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Selected text
            </div>
            <blockquote className="text-sm text-gray-800 border-l-4 border-gray-300 pl-3 italic line-clamp-4">
              {snippet}
            </blockquote>
          </div>

          <label className="block">
            <div className="text-sm font-medium text-gray-900">Kind</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AnnotationKind)}
              disabled={busy || isReadOnly}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50"
            >
              {ANNOTATION_KIND_ORDER.map((k) => {
                const cfg = ANNOTATION_KINDS[k];
                return (
                  <option key={k} value={k}>
                    {cfg.label} — {cfg.description}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-900">
              Note <span className="text-xs text-gray-500">(optional)</span>
            </div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy || isReadOnly}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
              placeholder="What did you notice about this passage?"
            />
          </label>

          {error && (
            <div className="text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div>
            {!isCreate && !isReadOnly && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isReadOnly ? "Close" : "Cancel"}
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={onSave}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--district-primary)" }}
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                {pending ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
