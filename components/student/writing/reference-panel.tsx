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

import { useMemo, useState } from "react";
import { SourceTextViewer } from "./source-text-viewer";
import { OpenOriginalButton } from "./open-original-button";
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
    <div className="space-y-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Reference
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

            <SourceTextViewer
              sourceText={source.sourceText}
              sourceHtml={source.sourceHtml}
              annotations={anns}
              visibleKinds={visibleKinds}
              scrollToAnnotationId={scrollTargetId}
              readOnly
            />

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
    </div>
  );
}
