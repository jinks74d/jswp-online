/**
 * Canonical PDF text/offset function (see
 * docs/superpowers/specs/2026-06-16-pdf-annotate-design.md §4).
 *
 * Turns pdf.js getTextContent() items into BOTH the plain `source_text`
 * substrate (at upload) AND the render metadata for the annotate text layer (at
 * render). Because the same function governs both, a text-layer selection maps
 * to a stable character offset into `source_text` by construction — no fuzzy
 * alignment. The separator rule (when to insert a space / newline / page break
 * between items) lives ONLY here, so it can't drift between extraction and
 * rendering.
 *
 * Pure + framework-agnostic: items are plain geometry (`{ str, hasEOL, x, y,
 * width }`), decoupled from pdfjs-dist, so the offset invariant is unit-testable
 * without loading a PDF. The extraction/render code maps pdf.js TextItems into
 * this shape (x = transform[4], y = transform[5], width = item.width).
 */

/** Fraction of a glyph's mean width that a gap must exceed to imply a space. */
const SPACE_RATIO = 0.3;

export interface PdfTextItem {
  readonly str: string;
  /** True when this item ends a line (pdf.js TextItem.hasEOL). */
  readonly hasEOL: boolean;
  /** Left edge in PDF user space. */
  readonly x: number;
  /** Baseline y (for future line grouping; carried through). */
  readonly y: number;
  /** Item advance width. */
  readonly width: number;
}

export interface PdfPage {
  readonly items: readonly PdfTextItem[];
}

export interface PdfTextSegment {
  readonly str: string;
  readonly pageIndex: number;
  /** Offset of this item's str within `text` (separators sit between items). */
  readonly startOffset: number;
  readonly endOffset: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface PdfTextResult {
  readonly text: string;
  readonly items: PdfTextSegment[];
}

/** An item touched by an annotation range, with the covered char sub-range. */
export interface CoveredItem {
  readonly item: PdfTextSegment;
  /** First covered char index within item.str (inclusive). */
  readonly fromChar: number;
  /** End covered char index within item.str (exclusive). */
  readonly toChar: number;
}

/**
 * Find the items an annotation range `[rangeStart, rangeEnd)` covers, with the
 * per-item character sub-range, so the viewer can draw highlight rects. Items
 * the range only touches via an inter-item separator are excluded (separators
 * belong to no item).
 */
export function itemsCoveringRange(
  items: readonly PdfTextSegment[],
  rangeStart: number,
  rangeEnd: number
): CoveredItem[] {
  const out: CoveredItem[] = [];
  for (const item of items) {
    const overlapStart = Math.max(rangeStart, item.startOffset);
    const overlapEnd = Math.min(rangeEnd, item.endOffset);
    if (overlapStart < overlapEnd) {
      out.push({
        item,
        fromChar: overlapStart - item.startOffset,
        toChar: overlapEnd - item.startOffset,
      });
    }
  }
  return out;
}

interface Placed {
  readonly item: PdfTextItem;
  readonly pageIndex: number;
}

/**
 * Separator inserted *before* `curr`, derived from the previous item:
 *   - different page → newline (page break)
 *   - previous item ended a line → newline
 *   - wide horizontal gap on the same line → space (unless already spaced)
 *   - otherwise → nothing (items abut)
 */
function separatorBetween(prev: Placed, curr: Placed): string {
  if (curr.pageIndex !== prev.pageIndex) return "\n";
  if (prev.item.hasEOL) return "\n";

  const gap = curr.item.x - (prev.item.x + prev.item.width);
  const meanGlyph =
    prev.item.str.length > 0
      ? prev.item.width / prev.item.str.length
      : prev.item.width;
  if (gap > meanGlyph * SPACE_RATIO) {
    if (prev.item.str.endsWith(" ") || curr.item.str.startsWith(" ")) return "";
    return " ";
  }
  return "";
}

export function buildPdfText(pages: readonly PdfPage[]): PdfTextResult {
  let text = "";
  const items: PdfTextSegment[] = [];
  let prev: Placed | null = null;

  pages.forEach((page, pageIndex) => {
    for (const item of page.items) {
      const curr: Placed = { item, pageIndex };
      if (prev) text += separatorBetween(prev, curr);
      const startOffset = text.length;
      text += item.str;
      items.push({
        str: item.str,
        pageIndex,
        startOffset,
        endOffset: text.length,
        x: item.x,
        y: item.y,
        width: item.width,
      });
      prev = curr;
    }
  });

  return { text, items };
}
