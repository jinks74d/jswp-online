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
});

describe("buildPdfText — empty / scanned PDF", () => {
  it("returns empty text when no pages have items", () => {
    expect(buildPdfText([page(), page()]).text).toBe("");
    expect(buildPdfText([]).text).toBe("");
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
