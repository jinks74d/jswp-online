/**
 * Unit coverage for the rich-source tree builder — the heart of the formatted
 * Reading & Annotation render (see
 * docs/superpowers/specs/2026-06-16-formatted-annotate-source-design.md).
 *
 * The critical invariant: the tree's flattened text, in document order, equals
 * the DOM textContent of the same HTML — which is exactly what
 * sourceHtmlToSubstrate stored as source_text. If this holds, every saved
 * annotation offset still lines up after we render formatted HTML instead of a
 * flat string.
 */

import { describe, it, expect } from "vitest";
import {
  buildRichTree,
  type RichNode,
} from "@/components/student/writing/rich-source-tree";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import {
  ANNOTATION_KIND_ORDER,
  type AnnotationKind,
} from "@/components/student/writing/annotation-kind-config";

const ALL_KINDS: ReadonlySet<AnnotationKind> = new Set(ANNOTATION_KIND_ORDER);

/** Concatenate every text run in document order. */
function flatten(nodes: readonly RichNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += n.runs.map((r) => r.text).join("");
    else out += flatten(n.children);
  }
  return out;
}

/** The substrate string the server would have stored for this HTML. */
function substrate(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

/** Depth-first search for the first element node with the given tag. */
function elementByTag(
  nodes: readonly RichNode[],
  tag: string
): Extract<RichNode, { type: "element" }> | undefined {
  for (const n of nodes) {
    if (n.type === "element") {
      if (n.tag === tag) return n;
      const inner = elementByTag(n.children, tag);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** Every marked run, in document order, as { text, id }. */
function markedRuns(
  nodes: readonly RichNode[]
): { text: string; id: string }[] {
  const acc: { text: string; id: string }[] = [];
  const visit = (ns: readonly RichNode[]) => {
    for (const n of ns) {
      if (n.type === "text") {
        for (const r of n.runs) {
          if (r.marked) acc.push({ text: r.text, id: r.annotation.id });
        }
      } else {
        visit(n.children);
      }
    }
  };
  visit(nodes);
  return acc;
}

function ann(
  id: string,
  range_start: number,
  range_end: number,
  kind: AnnotationKind = "cd"
): TextAnnotationRow {
  return {
    id,
    student_writing_id: "w1",
    range_start,
    range_end,
    selected_text: "",
    kind,
    note: null,
    created_at: "2026-06-16T00:00:00Z",
  };
}

describe("buildRichTree — text preservation (offset alignment)", () => {
  it("flattened text equals the DOM substrate across headings, lists, table, blockquote, link, and image", () => {
    const html =
      "<h2>Two Views</h2>" +
      "<p>Some <strong>students</strong> believe <a href=\"https://x.test\">it</a>.</p>" +
      "<ul><li>one</li><li>two</li></ul>" +
      "<blockquote>Quote here.</blockquote>" +
      "<table><tbody><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></tbody></table>" +
      "<p><img src=\"data:image/png;base64,iVBOR\" alt=\"fig\">After image.</p>";

    const tree = buildRichTree(html, [], ALL_KINDS);

    expect(flatten(tree)).toBe(substrate(html));
  });
});

describe("buildRichTree — mark wrapping", () => {
  it("splits a boundary-spanning annotation into one mark per element", () => {
    const html = "<h2>AB</h2><p>CD</p>"; // substrate "ABCD"
    const tree = buildRichTree(html, [ann("a1", 1, 3)], ALL_KINDS);

    // No text lost.
    expect(flatten(tree)).toBe("ABCD");

    // Two marks (same annotation), covering "B" then "C".
    expect(markedRuns(tree)).toEqual([
      { text: "B", id: "a1" },
      { text: "C", id: "a1" },
    ]);

    // "B" sits inside the <h2>, "C" inside the <p>.
    expect(markedRuns([tree[0]])).toEqual([{ text: "B", id: "a1" }]);
    expect(markedRuns([tree[1]])).toEqual([{ text: "C", id: "a1" }]);
  });

  it("ignores annotations whose kind is not visible", () => {
    const html = "<p>ABCD</p>";
    const onlyCd: ReadonlySet<AnnotationKind> = new Set(["cd"]);
    const tree = buildRichTree(
      html,
      [ann("hidden", 0, 2, "note"), ann("shown", 2, 4, "cd")],
      onlyCd
    );
    expect(markedRuns(tree)).toEqual([{ text: "CD", id: "shown" }]);
  });

  it("resolves overlapping annotations first-wins (earlier keeps the overlap)", () => {
    const html = "<p>ABCDEF</p>"; // offsets 0..6
    const tree = buildRichTree(
      html,
      [ann("first", 0, 3), ann("second", 2, 5)],
      ALL_KINDS
    );
    // first keeps [0,3) = "ABC"; second is clipped to [3,5) = "DE".
    expect(markedRuns(tree)).toEqual([
      { text: "ABC", id: "first" },
      { text: "DE", id: "second" },
    ]);
    expect(flatten(tree)).toBe("ABCDEF");
  });
});

describe("buildRichTree — element attributes", () => {
  it("keeps render-safe attributes on links and images", () => {
    const html =
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">link</a>' +
      '<img src="data:image/png;base64,iVBOR" alt="fig">';
    const tree = buildRichTree(html, [], ALL_KINDS);

    expect(elementByTag(tree, "a")?.attrs).toEqual({
      href: "https://x.test",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(elementByTag(tree, "img")?.attrs).toEqual({
      src: "data:image/png;base64,iVBOR",
      alt: "fig",
    });
  });

  it("drops attributes outside the render-safe allowlist", () => {
    const html = '<p id="x" data-foo="y" onclick="evil()">hi</p>';
    const tree = buildRichTree(html, [], ALL_KINDS);
    expect(elementByTag(tree, "p")?.attrs).toEqual({});
  });
});
