"use client";

/**
 * Read-only side panel: source text with the student's annotations
 * highlighted, plus a compact list of annotations grouped by kind.
 * Shared by the t-chart, gather-cds, and any future step that wants
 * to keep the source text + annotations visible while the student
 * works downstream artifacts.
 *
 * Reuses SourceTextViewer in readOnly mode (selection + mark-click
 * disabled). Kind filter is local; click-an-entry scrolls the viewer
 * to that annotation.
 */

import { useState } from "react";
import { SourceTextViewer } from "./source-text-viewer";
import {
  ANNOTATION_KINDS,
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "./annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

interface Props {
  sourceText: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  annotations: readonly TextAnnotationRow[];
}

export function ReferencePanel({
  sourceText,
  sourceTitle,
  sourceAuthor,
  annotations,
}: Props) {
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<AnnotationKind>>(
    () => new Set(ANNOTATION_KIND_ORDER)
  );
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);

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

  return (
    <div className="space-y-3">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Reference
        </div>
        {(sourceTitle || sourceAuthor) && (
          <div className="text-sm">
            {sourceTitle && (
              <span className="font-medium text-gray-800">{sourceTitle}</span>
            )}
            {sourceTitle && sourceAuthor && " · "}
            {sourceAuthor && <span className="text-gray-700">{sourceAuthor}</span>}
          </div>
        )}
      </header>

      {annotations.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
          No annotations from the previous step. You can still type CDs and
          CMs below — but going back to mark up the text first usually helps.
        </div>
      ) : (
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
                  className="rounded border-gray-300"
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

      <SourceTextViewer
        sourceText={sourceText}
        annotations={annotations}
        visibleKinds={visibleKinds}
        scrollToAnnotationId={scrollTargetId}
        readOnly
      />

      {annotations.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {ANNOTATION_KIND_ORDER.map((k) => {
            const items = annotations.filter((a) => a.kind === k);
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
                    <li key={a.id} className="border-b border-gray-100 last:border-b-0">
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
}
