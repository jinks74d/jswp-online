"use client";

/**
 * Renders the assignment's source text with annotation highlights and
 * surfaces user selections to the parent. Pure rendering + selection
 * detection — does not own annotation state or talk to server actions.
 *
 * Highlight algorithm (chunk 4.3 first-wins):
 *   Sort annotations by range_start. Walk the source text:
 *     - Plain segment: [lastEnd, ann.range_start)
 *     - Annotated segment: [max(lastEnd, ann.range_start), ann.range_end)
 *     - lastEnd ← ann.range_end
 *   Earlier annotations win the overlap; later ones get their start clipped.
 *
 * Offset mapping helper:
 *   Once highlights are rendered as <mark> wrappers, the source text spans
 *   multiple text nodes. window.getSelection() returns DOM Ranges with
 *   per-node offsets. getAbsoluteOffset walks the container's text nodes
 *   in document order, summing lengths until it reaches the target node,
 *   then adds the local offset. This is the single source of truth for
 *   "what character offset in the original source_text does this DOM
 *   position represent?"
 */

import { useEffect, useRef } from "react";
import {
  ANNOTATION_KINDS,
  type AnnotationKind,
} from "./annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

export interface SelectionPayload {
  rangeStart: number;
  rangeEnd: number;
  selectedText: string;
  /** Viewport-relative rectangle of the selection (for popover positioning). */
  rect: { top: number; left: number; right: number; bottom: number };
}

interface Props {
  sourceText: string;
  annotations: readonly TextAnnotationRow[];
  visibleKinds: ReadonlySet<AnnotationKind>;
  /** Annotation id to scroll into view; cleared by parent after use. */
  scrollToAnnotationId: string | null;
  onSelection: (payload: SelectionPayload) => void;
  onClearSelection: () => void;
  onAnnotationClick: (annotation: TextAnnotationRow) => void;
}

interface PlainSegment {
  kind: "plain";
  text: string;
}
interface AnnSegment {
  kind: "ann";
  text: string;
  annotation: TextAnnotationRow;
}
type Segment = PlainSegment | AnnSegment;

function buildSegments(
  source: string,
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>
): Segment[] {
  const filtered = annotations
    .filter((a) => visibleKinds.has(a.kind))
    .filter((a) => a.range_start < source.length)
    .slice()
    .sort((a, b) => a.range_start - b.range_start);

  const segs: Segment[] = [];
  let lastEnd = 0;
  for (const a of filtered) {
    if (a.range_start > lastEnd) {
      segs.push({ kind: "plain", text: source.slice(lastEnd, a.range_start) });
    }
    const effectiveStart = Math.max(lastEnd, a.range_start);
    const effectiveEnd = Math.min(a.range_end, source.length);
    if (effectiveStart < effectiveEnd) {
      segs.push({
        kind: "ann",
        text: source.slice(effectiveStart, effectiveEnd),
        annotation: a,
      });
      lastEnd = effectiveEnd;
    }
  }
  if (lastEnd < source.length) {
    segs.push({ kind: "plain", text: source.slice(lastEnd) });
  }
  return segs;
}

/**
 * Walks the container's text nodes in document order until it reaches
 * targetNode, then returns total + targetOffset. Returns -1 if the
 * targetNode isn't a descendant text node of the container.
 */
function getAbsoluteOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number
): number {
  if (!container.contains(targetNode)) return -1;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return total + targetOffset;
    }
    total += (node.textContent ?? "").length;
    node = walker.nextNode();
  }
  return -1;
}

export function SourceTextViewer({
  sourceText,
  annotations,
  visibleKinds,
  scrollToAnnotationId,
  onSelection,
  onClearSelection,
  onAnnotationClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth-scroll an annotation into view when the parent asks.
  useEffect(() => {
    if (!scrollToAnnotationId || !containerRef.current) return;
    const target = containerRef.current.querySelector(
      `[data-annotation-id="${scrollToAnnotationId}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToAnnotationId]);

  const handleMouseUp = () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      onClearSelection();
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    const startOffset = getAbsoluteOffset(
      container,
      range.startContainer,
      range.startOffset
    );
    const endOffset = getAbsoluteOffset(
      container,
      range.endContainer,
      range.endOffset
    );
    if (startOffset < 0 || endOffset < 0) {
      // Selection escapes the container.
      onClearSelection();
      return;
    }
    const [s, e] =
      startOffset <= endOffset
        ? [startOffset, endOffset]
        : [endOffset, startOffset];
    if (e - s < 1) {
      onClearSelection();
      return;
    }

    const text = sourceText.slice(s, e);
    const rect = range.getBoundingClientRect();

    onSelection({
      rangeStart: s,
      rangeEnd: e,
      selectedText: text,
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
    });
  };

  const segments = buildSegments(sourceText, annotations, visibleKinds);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="bg-white border border-gray-200 rounded-lg p-5 leading-relaxed text-gray-900 whitespace-pre-wrap select-text"
    >
      {segments.map((seg, i) => {
        if (seg.kind === "plain") {
          // Use a stable-ish key per-position; React keys based on index
          // are fine here because the segment list rebuilds on every
          // annotation change.
          return <span key={`p-${i}`}>{seg.text}</span>;
        }
        const cfg = ANNOTATION_KINDS[seg.annotation.kind];
        return (
          <mark
            key={`a-${seg.annotation.id}-${i}`}
            data-annotation-id={seg.annotation.id}
            className={`${cfg.highlightBg} rounded px-0.5 cursor-pointer text-inherit`}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationClick(seg.annotation);
            }}
            title={cfg.label}
          >
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
}
