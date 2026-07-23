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

/**
 * Fraction of a glyph's mean width that a baseline (y) jump must exceed to count
 * as a new line/region rather than intra-line jitter (super/subscripts, font
 * baseline rounding). Lines and footers jump by roughly a glyph height or more;
 * this stays well above sub-pixel noise.
 */
const LINE_Y_RATIO = 0.6;

/**
 * Fraction of a glyph's mean width that `curr` must start to the LEFT of `prev`'s
 * left edge to count as a new line/column. A token starting meaningfully left of
 * where the previous one began is a carriage-return / next-column, not a
 * same-line continuation, even when y is unchanged.
 */
const BACK_X_RATIO = 1;

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

/**
 * Minimal structural shape of a pdf.js `TextItem` we read. Declared here (rather
 * than imported from pdfjs-dist) so this module stays dependency-free and the
 * mapping is unit-testable with plain objects. pdf.js geometry lives in
 * `transform = [a, b, c, d, e, f]`, where e (index 4) is x and f (index 5) is y.
 */
export interface PdfJsTextItemLike {
  readonly str: string;
  readonly width: number;
  readonly transform: readonly number[];
  readonly hasEOL?: boolean;
}

/**
 * Type guard for a positioned pdf.js text item (vs a `TextMarkedContent`
 * marker). Exported so the render layer can filter `getTextContent().items`
 * with the EXACT predicate `pageFromPdfJsItems` uses — guaranteeing the
 * rendered spans align 1:1 with `buildPdfText`'s segments (and thus offsets).
 */
export function isPositionedTextItem(it: unknown): it is PdfJsTextItemLike {
  if (typeof it !== "object" || it === null) return false;
  const o = it as Record<string, unknown>;
  return (
    typeof o.str === "string" &&
    typeof o.width === "number" &&
    Array.isArray(o.transform) &&
    o.transform.length >= 6
  );
}

/**
 * Map one pdf.js `getTextContent().items` array into a `PdfPage`, dropping
 * `TextMarkedContent` marker entries (which carry no `str`/`transform`). This is
 * the only seam coupling rendering to pdfjs-dist; everything downstream consumes
 * the pure `PdfPage`/`buildPdfText` types. Keeping it pure (items in, page out)
 * means the offset pipeline can be exercised without loading a PDF.
 */
export function pageFromPdfJsItems(items: readonly unknown[]): PdfPage {
  const out: PdfTextItem[] = [];
  for (const it of items) {
    if (!isPositionedTextItem(it)) continue;
    out.push({
      str: it.str,
      hasEOL: it.hasEOL === true,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
    });
  }
  return { items: out };
}

/* ------------------------------------------------------------------ *
 * Margin stripping (running heads / footers / page numbers)
 * ------------------------------------------------------------------ */

/**
 * Pages an item must recur on (at the same vertical slot) before it counts as
 * furniture rather than prose. Two, because real JSWP source excerpts are
 * routinely 2 pages — a threshold of 3 silently no-ops on the common case.
 * Requiring byte-identical text at a byte-identical baseline on both pages is
 * still a strong signal: prose does not land twice at the same y.
 * Single-page sources cannot establish repetition and are left untouched.
 */
const MIN_REPEAT_PAGES = 2;

/**
 * Vertical bucket size (PDF user-space units) for deciding two items sit at
 * "the same" slot across pages. Running heads land on an identical baseline
 * page to page; this only absorbs sub-point rounding.
 */
const Y_BUCKET = 2;

/** Bucket an item's baseline so the same slot on different pages collides. */
function yKey(y: number): number {
  return Math.round(y / Y_BUCKET);
}

/** Normalized text used to match a running head/footer across pages. */
function textKey(str: string): string {
  return str.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A folio: bare digits, roman numerals, or the usual decorations ("38",
 * "- 38 -", "Page 38", "iv"). Shape alone is not enough — see `marginMask`,
 * which additionally requires everything else on the folio's line to be
 * furniture, so table data and prose numerals survive.
 */
function isPageNumberLike(str: string): boolean {
  const s = str.trim();
  if (s.length === 0 || s.length > 12) return false;
  return (
    /^[[(\-–—\s]*(?:page\s+)?\d{1,4}[\])\-–—.\s]*$/i.test(s) ||
    /^[[(\-–—\s]*[ivxlcdm]{1,7}[\])\-–—.\s]*$/i.test(s)
  );
}

/**
 * Per-page keep/drop mask, index-aligned with each `PdfPage.items`.
 *
 * Exported (rather than folded into `buildPdfText`) because the annotate text
 * layer walks the RAW pdf.js items to read their transform matrices, and must
 * skip exactly the items `buildPdfText` skipped — otherwise its 1:1 walk over
 * the returned segments desynchronizes and every span gets the wrong offset.
 * One mask function, two consumers, no drift.
 *
 * Detection is repetition-based, never geometric: an item is dropped when it
 * recurs at the same vertical slot on `MIN_REPEAT_PAGES`+ pages, either with
 * identical text (running head, copyright line) or as a lone folio whose digits
 * change page to page. Body prose does not repeat at a fixed baseline, so it
 * survives; a one-off note sitting in the side margin also survives, by design.
 */
export function marginMask(pages: readonly PdfPage[]): boolean[][] {
  const mask = pages.map((p) => p.items.map(() => true));
  if (pages.length < MIN_REPEAT_PAGES) return mask;

  // Pass 1: identical text recurring at the same vertical slot across pages.
  const textPages = new Map<string, Set<number>>();
  pages.forEach((p, pageIndex) => {
    for (const it of p.items) {
      const t = it.str.trim();
      if (t.length === 0) continue;
      const key = `${yKey(it.y)} ${textKey(t)}`;
      const seen = textPages.get(key) ?? new Set<number>();
      seen.add(pageIndex);
      textPages.set(key, seen);
    }
  });

  const droppedByText = pages.map((p, pageIndex) =>
    p.items.map((it) => {
      const t = it.str.trim();
      if (t.length === 0) return false;
      const seen = textPages.get(`${yKey(it.y)} ${textKey(t)}`);
      return !!seen && seen.size >= MIN_REPEAT_PAGES;
    })
  );

  const isFolioCandidate = pages.map((p, pageIndex) =>
    p.items.map((it, i) => {
      const t = it.str.trim();
      if (t.length === 0 || droppedByText[pageIndex][i]) return false;
      if (!isPageNumberLike(t)) return false;
      const slot = yKey(it.y);
      return p.items.every((other, j) => {
        if (j === i) return true;
        if (other.str.trim().length === 0) return true;
        if (yKey(other.y) !== slot) return true;
        return droppedByText[pageIndex][j];
      });
    })
  );

  // A number is a folio when everything ELSE on its line is already furniture.
  // That covers the lone page number AND the far more common combined footer
  // ("COPYRIGHT 2022. Louis Educational Concepts, LLC  78"), while still
  // sparing a number that shares a line with surviving prose.
  const folioSlotPages = new Map<number, Set<number>>();
  pages.forEach((p, pageIndex) => {
    p.items.forEach((it, i) => {
      if (!isFolioCandidate[pageIndex][i]) return;
      const slot = yKey(it.y);
      const seen = folioSlotPages.get(slot) ?? new Set<number>();
      seen.add(pageIndex);
      folioSlotPages.set(slot, seen);
    });
  });

  pages.forEach((p, pageIndex) => {
    p.items.forEach((it, i) => {
      if (droppedByText[pageIndex][i]) {
        mask[pageIndex][i] = false;
        return;
      }
      if (!isFolioCandidate[pageIndex][i]) return;
      const seen = folioSlotPages.get(yKey(it.y));
      if (seen && seen.size >= MIN_REPEAT_PAGES) mask[pageIndex][i] = false;
    });
  });

  return mask;
}

interface Placed {
  readonly item: PdfTextItem;
  readonly pageIndex: number;
}

/**
 * Normalize an item's text before it enters the substrate.
 *
 * pdf.js emits a trailing CR on some items in the browser build that the Node
 * legacy build does not, so the same PDF yielded "\r\n" in one and "\n" in the
 * other. Since `source_text` written by one environment must be reproducible by
 * the other (the viewer's live-vs-stored guard, and the re-extract script),
 * every CR is folded to a single LF here — one definition, both environments.
 */
function normalizeStr(str: string): string {
  return str.replace(/\r\n?/g, "\n");
}

/** A space, unless the adjacent items already carry one (avoid doubling). */
function spaceOrNothing(prev: Placed, curr: Placed): string {
  if (prev.item.str.endsWith(" ") || curr.item.str.startsWith(" ")) return "";
  return " ";
}

/**
 * Separator inserted *before* `curr`, derived from the previous item:
 *   - different page → newline (page break)
 *   - previous item ended a line → newline
 *   - new line/region (large y-jump, or `curr` starts well left of `prev`) →
 *     space. The horizontal-gap test below only makes sense for same-line items,
 *     so reading-order jumps to a footer (big y delta) or the next column
 *     (backward x) are caught here first — otherwise they'd glue (e.g.
 *     "LLC" + "38" → "LLC38", "Writing" + "COPYRIGHT" → "WritingCOPYRIGHT").
 *   - wide horizontal gap on the same line → space (unless already spaced)
 *   - otherwise → nothing (items abut)
 */
function separatorBetween(prev: Placed, curr: Placed): string {
  if (curr.pageIndex !== prev.pageIndex) return "\n";
  if (prev.item.hasEOL) return "\n";

  const meanGlyph =
    prev.item.str.length > 0
      ? prev.item.width / prev.item.str.length
      : prev.item.width;

  // New line/region: a baseline jump beyond intra-line jitter, or `curr`
  // starting meaningfully left of where `prev` began (carriage-return / column).
  const yJump = Math.abs(curr.item.y - prev.item.y);
  const backX = prev.item.x - curr.item.x;
  if (yJump > meanGlyph * LINE_Y_RATIO || backX > meanGlyph * BACK_X_RATIO) {
    return spaceOrNothing(prev, curr);
  }

  const gap = curr.item.x - (prev.item.x + prev.item.width);
  if (gap > meanGlyph * SPACE_RATIO) {
    return spaceOrNothing(prev, curr);
  }
  return "";
}

/**
 * Build the annotation substrate. Margin furniture (running heads, footers,
 * folios) is dropped via `marginMask` before any offset is assigned, so it
 * never enters `source_text` and is never annotatable. Because separators are
 * computed between SURVIVING neighbours, this also removes the glue artifacts
 * dropped furniture used to cause ("LLC" + "38" → "LLC38").
 */
export function buildPdfText(pages: readonly PdfPage[]): PdfTextResult {
  let text = "";
  const items: PdfTextSegment[] = [];
  let prev: Placed | null = null;
  const keep = marginMask(pages);

  pages.forEach((page, pageIndex) => {
    page.items.forEach((item, i) => {
      if (!keep[pageIndex][i]) return;
      const curr: Placed = { item, pageIndex };
      if (prev) text += separatorBetween(prev, curr);
      const startOffset = text.length;
      const str = normalizeStr(item.str);
      text += str;
      items.push({
        str,
        pageIndex,
        startOffset,
        endOffset: text.length,
        x: item.x,
        y: item.y,
        width: item.width,
      });
      prev = curr;
    });
  });

  return { text, items };
}
