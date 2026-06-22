/**
 * Unit coverage for buildPdfText — the canonical PDF text/offset function (see
 * docs/superpowers/specs/2026-06-16-pdf-annotate-design.md §4).
 *
 * The same function produces source_text at upload AND drives the annotate
 * text layer at render, so its output is the single source of truth for where
 * each PDF text item lives in the offset space that text_annotations index.
 * The critical invariant: every item's [startOffset, endOffset) slices `text`
 * back to exactly that item's str — so a selection maps to a stable offset.
 *
 * Items are synthetic (decoupled from pdfjs-dist): { str, hasEOL, x, y, width }.
 */

import { describe, it, expect } from "vitest";
import {
  buildPdfText,
  itemsCoveringRange,
  pageFromPdfJsItems,
  type PdfPage,
} from "@/lib/pdf-text";

function item(
  str: string,
  x: number,
  width: number,
  opts: { hasEOL?: boolean; y?: number } = {}
) {
  return { str, x, width, y: opts.y ?? 0, hasEOL: opts.hasEOL ?? false };
}

function page(...items: ReturnType<typeof item>[]): PdfPage {
  return { items };
}

describe("buildPdfText — separator rule", () => {
  it("inserts no separator between abutting items on a line", () => {
    // "Hello" ends at x=50; "World" starts at x=50 (gap 0).
    const { text } = buildPdfText([
      page(item("Hello", 0, 50), item("World", 50, 50)),
    ]);
    expect(text).toBe("HelloWorld");
  });

  it("inserts a space when the horizontal gap is wide", () => {
    // "Hello" ends at 50; "World" starts at 80 (gap 30 >> glyph width).
    const { text } = buildPdfText([
      page(item("Hello", 0, 50), item("World", 80, 50)),
    ]);
    expect(text).toBe("Hello World");
  });

  it("inserts a newline after an end-of-line item", () => {
    const { text } = buildPdfText([
      page(item("Line1", 0, 50, { hasEOL: true }), item("Line2", 0, 50)),
    ]);
    expect(text).toBe("Line1\nLine2");
  });

  it("inserts a newline at a page break", () => {
    const { text } = buildPdfText([
      page(item("PageOne", 0, 70)),
      page(item("PageTwo", 0, 70)),
    ]);
    expect(text).toBe("PageOne\nPageTwo");
  });

  it("does not double a space the item already carries", () => {
    const { text } = buildPdfText([
      page(item("Hello ", 0, 60), item("World", 80, 50)),
    ]);
    expect(text).toBe("Hello World");
  });
});

describe("buildPdfText — line/region grouping (glued-token fixes)", () => {
  // Real-PDF reading order can place the next item on a different line/region
  // without pdf.js setting hasEOL. The horizontal-gap test only makes sense for
  // same-line items, so a y-jump (or a backward x-jump) must itself separate.

  it("separates a footer page number that abuts preceding text", () => {
    // "...LLC" sits on a body line (y=500); "38" is the page-number footer far
    // below (y=40). pdf.js doesn't flag hasEOL, and the footer's x lands such
    // that the same-line gap test sees a small/negative gap → previously glued
    // into "LLC38". The y-jump must force a separator.
    const { text } = buildPdfText([
      page(
        item("LLC", 400, 30, { y: 500 }),
        item("38", 300, 16, { y: 40 })
      ),
    ]);
    expect(text).toBe("LLC 38");
  });

  it("separates a column/heading boundary where x jumps backward", () => {
    // "Writing" ends a left-column line at x=120; "COPYRIGHT" starts the next
    // region back at the left margin (x=0) on a different line (y differs).
    // Same-line gap test saw a large negative gap → no space → "WritingCOPYRIGHT".
    const { text } = buildPdfText([
      page(
        item("Writing", 60, 60, { y: 500 }),
        item("COPYRIGHT", 0, 90, { y: 480 })
      ),
    ]);
    expect(text).toBe("Writing COPYRIGHT");
  });

  it("separates a backward x-jump even when y is unchanged (new column/line)", () => {
    // Some extractors keep y constant across a wrapped/column break; an item
    // starting well to the LEFT of the previous item's left edge is a new line.
    const { text } = buildPdfText([
      page(
        item("rightcol", 300, 80, { y: 200 }),
        item("leftcol", 0, 70, { y: 200 })
      ),
    ]);
    expect(text).toBe("rightcol leftcol");
  });

  it("does not insert a separator for sub-pixel baseline jitter on one line", () => {
    // Tiny y differences (font baseline rounding) within a line must NOT break.
    const { text } = buildPdfText([
      page(
        item("super", 0, 40, { y: 100 }),
        item("script", 40, 40, { y: 100.4 })
      ),
    ]);
    expect(text).toBe("superscript");
  });

  it("does not double a separator when the line item already carries a space", () => {
    const { text } = buildPdfText([
      page(
        item("LLC ", 400, 36, { y: 500 }),
        item("38", 300, 16, { y: 40 })
      ),
    ]);
    expect(text).toBe("LLC 38");
  });

  it("still abuts same-line items the gap test joins (no false line break)", () => {
    const { text } = buildPdfText([
      page(
        item("Hello", 0, 50, { y: 700 }),
        item("World", 50, 50, { y: 700 })
      ),
    ]);
    expect(text).toBe("HelloWorld");
  });
});

describe("buildPdfText — offset tiling invariant", () => {
  it("every item's [startOffset,endOffset) slices text back to its str", () => {
    const { text, items } = buildPdfText([
      page(
        item("The", 0, 30),
        item("quick", 40, 50),
        item("fox", 0, 30, { hasEOL: false, y: -20 })
      ),
      page(item("jumped", 0, 60)),
    ]);
    expect(items).toHaveLength(4);
    for (const it of items) {
      expect(text.slice(it.startOffset, it.endOffset)).toBe(it.str);
    }
    // Offsets are ascending and non-overlapping.
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startOffset).toBeGreaterThanOrEqual(items[i - 1].endOffset);
    }
  });

  it("carries pageIndex through to each item", () => {
    const { items } = buildPdfText([
      page(item("a", 0, 10)),
      page(item("b", 0, 10)),
    ]);
    expect(items.map((i) => i.pageIndex)).toEqual([0, 1]);
  });

  it("tiles text contiguously across line/region breaks (no gaps/overlaps)", () => {
    // Mixes every separator path: abutting, gap-space, hasEOL newline, page
    // break, footer y-jump, and a backward x-jump column break. Whatever
    // separators land between items, each item's slice must still equal its str
    // and offsets must remain ascending and non-overlapping.
    const { text, items } = buildPdfText([
      page(
        item("Header", 0, 60, { y: 700 }),
        item("right", 200, 50, { y: 700 }), // gap → space
        item("COPYRIGHT", 0, 90, { y: 680 }), // backward x → region break
        item("Body", 0, 40, { y: 640, hasEOL: true }), // hasEOL → newline
        item("LLC", 400, 30, { y: 620 }),
        item("38", 300, 16, { y: 40 }) // footer y-jump
      ),
      page(item("PageTwo", 0, 70, { y: 700 })), // page break
    ]);
    expect(items).toHaveLength(7);
    for (const it of items) {
      expect(text.slice(it.startOffset, it.endOffset)).toBe(it.str);
    }
    // Offsets ascending and non-overlapping (endOffset[i-1] <= startOffset[i]).
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startOffset).toBeGreaterThanOrEqual(items[i - 1].endOffset);
    }
    // And contiguous: the first item starts at 0 and the last ends at text.length.
    expect(items[0].startOffset).toBe(0);
    expect(items[items.length - 1].endOffset).toBe(text.length);
  });
});

describe("buildPdfText — empty / scanned PDF", () => {
  it("returns empty text when no pages have items", () => {
    expect(buildPdfText([page(), page()]).text).toBe("");
    expect(buildPdfText([]).text).toBe("");
  });
});

describe("pageFromPdfJsItems — pdf.js TextContent → PdfPage", () => {
  // pdf.js TextItem geometry lives in transform = [a,b,c,d,e,f]; e=x (index 4),
  // f=y (index 5). This mapping is the silent-failure-prone seam between
  // pdfjs-dist and the pure buildPdfText pipeline, so it gets its own coverage.
  it("maps str / hasEOL / width and pulls x,y from transform[4],[5]", () => {
    const pdfItem = {
      str: "Hello",
      hasEOL: true,
      width: 50,
      height: 12,
      dir: "ltr",
      transform: [12, 0, 0, 12, 72, 700],
      fontName: "g_d0_f1",
    };
    const pageOut = pageFromPdfJsItems([pdfItem]);
    expect(pageOut.items).toEqual([
      { str: "Hello", hasEOL: true, x: 72, y: 700, width: 50 },
    ]);
  });

  it("drops TextMarkedContent markers (no str / transform)", () => {
    const items = [
      { type: "beginMarkedContent" },
      {
        str: "Body",
        hasEOL: false,
        width: 40,
        transform: [12, 0, 0, 12, 10, 500],
      },
      { type: "endMarkedContent" },
    ];
    const pageOut = pageFromPdfJsItems(items);
    expect(pageOut.items).toHaveLength(1);
    expect(pageOut.items[0].str).toBe("Body");
  });

  it("defaults hasEOL to false when the item omits it", () => {
    const pageOut = pageFromPdfJsItems([
      { str: "x", width: 5, transform: [1, 0, 0, 1, 0, 0] },
    ]);
    expect(pageOut.items[0].hasEOL).toBe(false);
  });

  it("feeds buildPdfText to keep offsets aligned with source_text", () => {
    // The whole point: the page this yields, run through buildPdfText, is the
    // exact text stored as source_text at upload.
    const items = [
      { str: "Jane", hasEOL: false, width: 40, transform: [12, 0, 0, 12, 0, 0] },
      {
        str: "Schaffer",
        hasEOL: false,
        width: 80,
        transform: [12, 0, 0, 12, 60, 0],
      },
    ];
    const { text } = buildPdfText([pageFromPdfJsItems(items)]);
    expect(text).toBe("Jane Schaffer");
  });
});

describe("itemsCoveringRange — offset → highlightable items", () => {
  // "Hello World" → items: Hello [0,5), space sep, World [6,11).
  const { items } = buildPdfText([
    page(item("Hello", 0, 50), item("World", 80, 50)),
  ]);

  it("returns the single item and sub-range for a range inside one item", () => {
    // characters 1..3 of "Hello" = "el"
    const covered = itemsCoveringRange(items, 1, 3);
    expect(covered).toHaveLength(1);
    expect(covered[0].item.str).toBe("Hello");
    expect(covered[0].fromChar).toBe(1);
    expect(covered[0].toChar).toBe(3);
  });

  it("returns whole-item coverage with fromChar 0 / toChar length", () => {
    const covered = itemsCoveringRange(items, 0, 5);
    expect(covered).toHaveLength(1);
    expect(covered[0].fromChar).toBe(0);
    expect(covered[0].toChar).toBe(5);
  });

  it("spans multiple items, clipping the partial ends", () => {
    // offset 3..8 → "lo" (Hello[3,5)) + "Wo" (World[6,8)); the space at 5 is a
    // separator, not part of any item.
    const covered = itemsCoveringRange(items, 3, 8);
    expect(covered.map((c) => c.item.str)).toEqual(["Hello", "World"]);
    expect(covered[0].fromChar).toBe(3);
    expect(covered[0].toChar).toBe(5);
    expect(covered[1].fromChar).toBe(0);
    expect(covered[1].toChar).toBe(2);
  });

  it("excludes items the range does not touch", () => {
    const covered = itemsCoveringRange(items, 7, 9); // inside World only
    expect(covered).toHaveLength(1);
    expect(covered[0].item.str).toBe("World");
  });
});
