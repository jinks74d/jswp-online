/**
 * Renders the rich-source tree to real DOM and verifies (a) the element
 * structure survives, (b) marked runs flow through the renderMark callback,
 * and (c) the rendered container's textContent equals the source substrate —
 * the in-DOM proof of the offset-alignment invariant the unit tests assert at
 * the data level.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RichSourceBody } from "@/components/student/writing/rich-source-body";
import { buildRichTree } from "@/components/student/writing/rich-source-tree";
import { ANNOTATION_KIND_ORDER } from "@/components/student/writing/annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

const ALL = new Set(ANNOTATION_KIND_ORDER);

function ann(id: string, s: number, e: number): TextAnnotationRow {
  return {
    id,
    student_writing_id: "w1",
    range_start: s,
    range_end: e,
    selected_text: "",
    kind: "cd",
    note: null,
    created_at: "2026-06-16T00:00:00Z",
  };
}

describe("RichSourceBody", () => {
  it("renders formatted elements, routes marks through renderMark, and preserves textContent", () => {
    const html =
      "<h2>AB</h2>" +
      "<table><tbody><tr><td>CD</td></tr></tbody></table>";
    const tree = buildRichTree(html, [ann("a1", 1, 3)], ALL); // marks "B" then "C"

    const { container } = render(
      <RichSourceBody
        nodes={tree}
        renderMark={(annotation, text, key) => (
          <mark key={key} data-annotation-id={annotation.id}>
            {text}
          </mark>
        )}
      />
    );

    // Structure preserved.
    expect(container.querySelector("h2")).not.toBeNull();
    expect(container.querySelector("table td")).not.toBeNull();

    // Two marks, in document order, carrying the annotation id.
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.map((m) => m.textContent)).toEqual(["B", "C"]);
    expect(marks.every((m) => m.getAttribute("data-annotation-id") === "a1")).toBe(
      true
    );

    // Alignment: rendered text equals the substrate.
    const substrate =
      new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    expect(container.textContent).toBe(substrate);
  });
});
