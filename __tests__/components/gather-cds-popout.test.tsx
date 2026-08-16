/**
 * The Gather-CDs pop-out must contain the WORK, not just the source.
 *
 * The first version wrapped only the reference column, which expanded the
 * passage to full screen and left the body-paragraph cards behind it — the
 * opposite of useful, since the reason to pop out is that the CD rows are hard
 * to read in a 22rem-constrained two-column layout. These assertions pin that
 * every Body Paragraph section is inside the dialog subtree, not merely
 * somewhere on the page.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GatherCdsClient } from "@/components/student/writing/gather-cds/gather-cds-client";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";

vi.mock("@/components/student/writing/gather-cds/sheet-editor", () => ({
  SheetEditor: ({ sheet }: { sheet: GatheringSheetData }) => (
    <div data-testid={`sheet-${sheet.body_paragraph_position}`}>
      concrete details for BP {sheet.body_paragraph_position}
    </div>
  ),
}));

vi.mock("@/components/student/writing/reference-panel", () => ({
  ReferencePanel: ({ showPopout }: { showPopout?: boolean }) => (
    <div data-testid="reference-panel">
      {showPopout === false ? "no-inner-popout" : "inner-popout"}
    </div>
  ),
}));

vi.mock("@/lib/actions/student-writings", () => ({
  completeStepAndAdvance: vi.fn(),
}));

vi.mock("@/components/student/writing/step-shell", () => ({
  StepFooter: () => <div data-testid="step-footer" />,
}));

const sheet = (position: number): GatheringSheetData => ({
  id: `sheet-${position}`,
  body_paragraph_position: position,
  task_portion: null,
  candidates: [
    {
      id: `cand-${position}`,
      text: "A concrete detail",
      position: 1,
      is_selected: true,
    },
  ] as GatheringSheetData["candidates"],
});

const SOURCES = [
  {
    sourceId: "s1",
    kind: "primary" as const,
    sourceText: "passage",
    sourceTitle: null,
    sourceAuthor: null,
    sourceFilePath: null,
    sourceFileName: null,
    sourceHtml: null,
    sourceRenderMode: "plain" as const,
  },
];

const renderClient = (sources = SOURCES) =>
  render(
    <GatherCdsClient
      writingId="w-1"
      stepKey="expository.gather_cds"
      sheets={[sheet(1), sheet(2)]}
      sources={sources}
      annotations={[]}
    />
  );

describe("GatherCdsClient — pop out", () => {
  it("puts every Body Paragraph and its concrete details inside the dialog", () => {
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));

    const dialog = screen.getByRole("dialog", {
      name: "Gather concrete details",
    });
    // within(), not screen — "on the page somewhere" is exactly the bug.
    expect(
      within(dialog).getByRole("heading", { name: "Body Paragraph 1" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Body Paragraph 2" })
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("sheet-1")).toBeInTheDocument();
    expect(within(dialog).getByTestId("sheet-2")).toBeInTheDocument();
  });

  it("keeps the source alongside the work when popped out", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByTestId("reference-panel").length).toBeGreaterThan(0);
  });

  it("suppresses the reference panel's own pop-out so the two cannot nest", () => {
    renderClient();
    for (const panel of screen.getAllByTestId("reference-panel")) {
      expect(panel).toHaveTextContent("no-inner-popout");
    }
  });

  it("still offers the pop-out when the assignment has no source", () => {
    renderClient([]);

    expect(screen.queryByTestId("reference-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Body Paragraph 1" })
    ).toBeInTheDocument();
  });

  it("closes on Escape and returns to the inline layout", () => {
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The work is still on the page — collapsing must not unmount it.
    expect(
      screen.getByRole("heading", { name: "Body Paragraph 1" })
    ).toBeInTheDocument();
  });
});
