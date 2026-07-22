/**
 * Integration coverage for SourceTextViewer's rich branch: when sourceHtml is
 * present it renders formatted DOM with highlights; when absent it keeps the
 * existing flat plain-text render (no regression).
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SourceTextViewer } from "@/components/student/writing/source-text-viewer";
import { ANNOTATION_KIND_ORDER } from "@/components/student/writing/annotation-kind-config";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

const ALL = new Set(ANNOTATION_KIND_ORDER);

function ann(id: string, s: number, e: number): TextAnnotationRow {
  return {
    id,
    student_writing_id: "w1",
    source_id: null,
    range_start: s,
    range_end: e,
    selected_text: "",
    kind: "cd",
    note: null,
    created_at: "2026-06-16T00:00:00Z",
  };
}

describe("SourceTextViewer — rich mode", () => {
  it("renders formatted HTML with a highlighted annotation", () => {
    const { container } = render(
      <SourceTextViewer
        sourceText="ABCD"
        sourceHtml="<h2>AB</h2><p>CD</p>"
        annotations={[ann("a1", 1, 3)]}
        visibleKinds={ALL}
        scrollToAnnotationId={null}
        readOnly
      />
    );

    expect(container.querySelector("h2")).not.toBeNull();
    const mark = container.querySelector('mark[data-annotation-id="a1"]');
    expect(mark).not.toBeNull();
    expect(container.textContent).toBe("ABCD");
  });
});

describe("SourceTextViewer — flat mode (no sourceHtml)", () => {
  it("renders plain text without formatting elements", () => {
    const { container } = render(
      <SourceTextViewer
        sourceText="Hello world"
        annotations={[]}
        visibleKinds={ALL}
        scrollToAnnotationId={null}
        readOnly
      />
    );

    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).toBe("Hello world");
  });
});
