"use client";

/**
 * List of annotations grouped by kind. Per-kind checkboxes filter the
 * highlights in the source viewer; clicking an entry asks the parent
 * to scroll that annotation into view (handled by the viewer's effect).
 *
 * Mobile: rendered as a <details> accordion below the viewer (via the
 * containing layout) — viewing existing annotations on a phone works,
 * but the create flow is desktop-first per the chunk spec.
 */

import {
  ANNOTATION_KINDS,
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "./annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

interface Props {
  annotations: readonly TextAnnotationRow[];
  visibleKinds: ReadonlySet<AnnotationKind>;
  onToggleKind: (kind: AnnotationKind) => void;
  onSelectAnnotation: (annotation: TextAnnotationRow) => void;
}

export function AnnotationSidebar({
  annotations,
  visibleKinds,
  onToggleKind,
  onSelectAnnotation,
}: Props) {
  const grouped = groupByKind(annotations);

  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
        <div className="text-xs uppercase tracking-wide text-gray-500 px-1 mb-1">
          Show
        </div>
        {ANNOTATION_KIND_ORDER.map((k) => {
          const cfg = ANNOTATION_KINDS[k];
          const count = grouped[k]?.length ?? 0;
          const checked = visibleKinds.has(k);
          return (
            <label
              key={k}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleKind(k)}
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

      {annotations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
          No annotations yet.
        </div>
      ) : (
        <div className="space-y-3">
          {ANNOTATION_KIND_ORDER.map((k) => {
            const items = grouped[k] ?? [];
            if (items.length === 0) return null;
            const cfg = ANNOTATION_KINDS[k];
            return (
              <section
                key={k}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <header
                  className={`px-3 py-2 border-b border-gray-200 flex items-center gap-2 ${cfg.accentText}`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${cfg.dotBg}`}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {cfg.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">
                    {items.length}
                  </span>
                </header>
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
                        <div className="text-sm text-gray-900 line-clamp-2">
                          {a.selected_text}
                        </div>
                        {a.note && (
                          <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                            {a.note}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function groupByKind(
  annotations: readonly TextAnnotationRow[]
): Record<AnnotationKind, TextAnnotationRow[]> {
  const groups: Record<AnnotationKind, TextAnnotationRow[]> = {
    cd: [],
    cm: [],
    transition: [],
    note: [],
  };
  for (const a of annotations) {
    groups[a.kind].push(a);
  }
  return groups;
}
