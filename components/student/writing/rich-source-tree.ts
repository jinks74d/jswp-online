/**
 * Builds a renderable tree from sanitized source HTML for the formatted
 * Reading & Annotation view (see
 * docs/superpowers/specs/2026-06-16-formatted-annotate-source-design.md).
 *
 * The tree mirrors the HTML element structure (headings, paragraphs, lists,
 * tables, blockquotes, links, images) but splits each text node into
 * marked/unmarked runs at annotation boundaries. Because the walk visits text
 * nodes in the same document order that sourceHtmlToSubstrate used to derive
 * source_text, the concatenation of all run text equals source_text — so
 * character offsets (text_annotations.range_start/end) still line up.
 *
 * Pure + framework-agnostic: returns data, not React elements, so the offset
 * invariant is unit-testable without rendering. The viewer maps RichNode →
 * JSX. Runs in the browser/jsdom (uses DOMParser).
 */

import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import type { AnnotationKind } from "./annotation-kind-config";

export type RichTextRun =
  | { readonly marked: false; readonly text: string }
  | {
      readonly marked: true;
      readonly text: string;
      readonly annotation: TextAnnotationRow;
    };

export type RichNode =
  | { readonly type: "text"; readonly runs: readonly RichTextRun[] }
  | {
      readonly type: "element";
      readonly tag: string;
      readonly attrs: Readonly<Record<string, string>>;
      readonly children: readonly RichNode[];
    };

interface Interval {
  readonly start: number;
  readonly end: number;
  readonly annotation: TextAnnotationRow;
}

interface WalkState {
  offset: number;
}

/**
 * Attributes the renderer maps to valid React DOM props. source_html is
 * already sanitized server-side, so this is defense-in-depth — it also keeps
 * React from warning on stray attributes (id, data-attributes, and so on).
 */
const RENDER_SAFE_ATTRS = ["href", "target", "rel", "src", "alt"] as const;

export function buildRichTree(
  html: string,
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>
): readonly RichNode[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const total = (doc.body.textContent ?? "").length;
  const intervals = computeIntervals(annotations, visibleKinds, total);
  return walkChildren(doc.body, intervals, { offset: 0 });
}

/**
 * Resolve overlapping annotations into a sorted set of non-overlapping
 * intervals using the same "first-wins" rule as the flat SourceTextViewer:
 * sort by range_start; an earlier annotation keeps the overlap, a later one's
 * start is clipped to where the earlier one ended.
 */
function computeIntervals(
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>,
  total: number
): Interval[] {
  const filtered = annotations
    .filter((a) => visibleKinds.has(a.kind))
    .filter((a) => a.range_start < total)
    .slice()
    .sort((a, b) => a.range_start - b.range_start);

  const out: Interval[] = [];
  let lastEnd = 0;
  for (const a of filtered) {
    const start = Math.max(lastEnd, a.range_start);
    const end = Math.min(a.range_end, total);
    if (start < end) {
      out.push({ start, end, annotation: a });
      lastEnd = end;
    }
  }
  return out;
}

function walkChildren(
  parent: Node,
  intervals: readonly Interval[],
  state: WalkState
): RichNode[] {
  const out: RichNode[] = [];
  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.length > 0) {
        out.push({ type: "text", runs: splitText(text, state.offset, intervals) });
        state.offset += text.length;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      out.push({
        type: "element",
        tag: el.tagName.toLowerCase(),
        attrs: extractAttrs(el),
        children: walkChildren(el, intervals, state),
      });
    }
  });
  return out;
}

function extractAttrs(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const name of RENDER_SAFE_ATTRS) {
    const value = el.getAttribute(name);
    if (value !== null) attrs[name] = value;
  }
  return attrs;
}

/**
 * Split one text node (spanning [nodeStart, nodeStart+text.length) in global
 * offset space) into marked/unmarked runs against the sorted intervals.
 */
function splitText(
  text: string,
  nodeStart: number,
  intervals: readonly Interval[]
): RichTextRun[] {
  const nodeEnd = nodeStart + text.length;
  const runs: RichTextRun[] = [];
  let cursor = nodeStart;

  for (const iv of intervals) {
    if (iv.end <= nodeStart) continue;
    if (iv.start >= nodeEnd) break; // intervals are sorted ascending
    const segStart = Math.max(iv.start, nodeStart);
    const segEnd = Math.min(iv.end, nodeEnd);
    if (segStart > cursor) {
      runs.push({
        marked: false,
        text: text.slice(cursor - nodeStart, segStart - nodeStart),
      });
    }
    runs.push({
      marked: true,
      text: text.slice(segStart - nodeStart, segEnd - nodeStart),
      annotation: iv.annotation,
    });
    cursor = segEnd;
  }
  if (cursor < nodeEnd) {
    runs.push({ marked: false, text: text.slice(cursor - nodeStart) });
  }
  return runs;
}
