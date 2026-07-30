/**
 * Which annotations become the "From your annotations" list on the T-Chart's
 * CMs column. Every `cd` annotation carries required commentary in `note`
 * and every `cm` annotation is commentary in its own right; the margin-
 * reading kinds (main idea, transition, note) are not.
 */

import { describe, it, expect } from "vitest";
import { selectAnnotationCommentary } from "@/components/student/writing/t-chart/annotation-commentary";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

function ann(overrides: Partial<TextAnnotationRow>): TextAnnotationRow {
  return {
    id: "a1",
    student_writing_id: "w1",
    source_id: null,
    range_start: 0,
    range_end: 10,
    selected_text: "some text",
    kind: "cd",
    note: "some commentary",
    created_at: "2026-07-26T00:00:00Z",
    ...overrides,
  } as TextAnnotationRow;
}

describe("selectAnnotationCommentary", () => {
  it("takes a CD annotation's note as the commentary, with the quote for context", () => {
    const items = selectAnnotationCommentary([
      ann({
        selected_text: "sewing machine",
        kind: "cd",
        note: "resourceful; had forethought",
      }),
    ]);

    expect(items).toEqual([
      {
        id: "a1",
        quoted: "sewing machine",
        commentary: "resourceful; had forethought",
      },
    ]);
  });

  it("takes a CM annotation without a quote attribution", () => {
    const items = selectAnnotationCommentary([
      ann({ kind: "cm", selected_text: "highlighted", note: "her grit shows" }),
    ]);

    expect(items[0]!.quoted).toBeNull();
    expect(items[0]!.commentary).toBe("her grit shows");
  });

  it("falls back to a CM annotation's highlighted text when it has no note", () => {
    const items = selectAnnotationCommentary([
      ann({ kind: "cm", selected_text: "unconditional love", note: null }),
    ]);

    expect(items[0]!.commentary).toBe("unconditional love");
  });

  it("skips a CD annotation with no commentary written yet", () => {
    expect(
      selectAnnotationCommentary([ann({ kind: "cd", note: null })])
    ).toEqual([]);
    expect(
      selectAnnotationCommentary([ann({ kind: "cd", note: "   " })])
    ).toEqual([]);
  });

  it("skips the margin-reading kinds", () => {
    const items = selectAnnotationCommentary([
      ann({ id: "m", kind: "main_idea", note: "the thesis" }),
      ann({ id: "t", kind: "transition", note: "signals contrast" }),
      ann({ id: "n", kind: "note", note: "look up later" }),
    ]);

    expect(items).toEqual([]);
  });

  it("collapses the CR/LF runs that PDF-extracted highlights carry", () => {
    const items = selectAnnotationCommentary([
      ann({
        kind: "cd",
        selected_text: "feet\r\nwrapped in rags,   she walked",
        note: "shows  perseverance,\r\ndetermination",
      }),
    ]);

    expect(items[0]!.quoted).toBe("feet wrapped in rags, she walked");
    expect(items[0]!.commentary).toBe("shows perseverance, determination");
  });

  it("preserves source order across kinds", () => {
    const items = selectAnnotationCommentary([
      ann({ id: "1", kind: "cd", note: "first" }),
      ann({ id: "x", kind: "note", note: "ignored" }),
      ann({ id: "2", kind: "cm", note: "second" }),
      ann({ id: "3", kind: "cd", note: "third" }),
    ]);

    expect(items.map((i) => i.commentary)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
