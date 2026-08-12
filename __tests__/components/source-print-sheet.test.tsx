/**
 * Renders the printable source sheet to real DOM and verifies the artifact the
 * student ends up holding: the §10 header, the source's own byline, the full
 * text of the passage — and, critically, NONE of their annotations. The
 * clean-copy promise is the whole point of this sheet (they mark it up by
 * hand), so it is asserted rather than assumed.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourcePrintSheet } from "@/components/student/writing/print/source-print-sheet";
import type { PrintSourceMeta } from "@/components/student/writing/print/print-source-plan";

const META: PrintSourceMeta = {
  studentName: "Alex Rivera",
  assignmentTitle: "The Cost of Convenience",
  modeLabel: "Expository / Informational",
  draftNumber: 1,
};

const PLAIN = "Every year, eight million metric tons of plastic enter the ocean.";

describe("SourcePrintSheet", () => {
  it("heads the page with the student, assignment, mode and print date", () => {
    render(
      <SourcePrintSheet
        meta={META}
        sourceTitle={null}
        sourceAuthor={null}
        sourceText={PLAIN}
        sourceHtml={null}
      />
    );

    expect(
      screen.getByText("Alex Rivera · The Cost of Convenience")
    ).toBeInTheDocument();
    // The date resolves after mount; assert the shape, not a frozen day.
    expect(
      screen.getByText(/^Expository \/ Informational · printed .+/)
    ).toBeInTheDocument();
  });

  it("names the draft once the student is past their first", () => {
    render(
      <SourcePrintSheet
        meta={{ ...META, draftNumber: 3 }}
        sourceTitle={null}
        sourceAuthor={null}
        sourceText={PLAIN}
        sourceHtml={null}
      />
    );

    expect(screen.getByText(/· Draft 3$/)).toBeInTheDocument();
  });

  it("prints the source's title and byline above the passage", () => {
    render(
      <SourcePrintSheet
        meta={META}
        sourceTitle="Plastic in the Pacific"
        sourceAuthor="M. Chen"
        sourceText={PLAIN}
        sourceHtml={null}
      />
    );

    expect(screen.getByText("Plastic in the Pacific")).toBeInTheDocument();
    expect(screen.getByText("by M. Chen")).toBeInTheDocument();
    expect(screen.getByText(PLAIN)).toBeInTheDocument();
  });

  it("renders plain text with whitespace preserved so paragraphing survives", () => {
    const twoParas = "First paragraph.\n\nSecond paragraph.";
    const { container } = render(
      <SourcePrintSheet
        meta={META}
        sourceTitle={null}
        sourceAuthor={null}
        sourceText={twoParas}
        sourceHtml={null}
      />
    );

    const body = container.querySelector(".whitespace-pre-wrap");
    expect(body?.textContent).toBe(twoParas);
  });

  it("renders rich sources as formatted elements, not flattened text", () => {
    const html =
      "<h2>Background</h2><p>Eight million tons.</p>" +
      "<blockquote>A rotating current.</blockquote>";

    const { container } = render(
      <SourcePrintSheet
        meta={META}
        sourceTitle={null}
        sourceAuthor={null}
        sourceText="BackgroundEight million tons.A rotating current."
        sourceHtml={html}
      />
    );

    expect(container.querySelector("h2")?.textContent).toBe("Background");
    expect(container.querySelector("p")?.textContent).toBe(
      "Eight million tons."
    );
    expect(container.querySelector("blockquote")?.textContent).toBe(
      "A rotating current."
    );
  });

  it("carries no annotation highlights — the sheet is a clean copy", () => {
    const { container } = render(
      <SourcePrintSheet
        meta={META}
        sourceTitle={null}
        sourceAuthor={null}
        sourceText={PLAIN}
        sourceHtml={`<p>${PLAIN}</p>`}
      />
    );

    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.querySelector("[data-annotation-id]")).toBeNull();
  });
});
