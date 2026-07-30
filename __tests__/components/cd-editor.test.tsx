/**
 * Covers the shared CdEditor's Embedding-Quotations (TLCD) affordance, now
 * used by expository AND argumentation/literary T-Charts (the "mirror TLCD UI"
 * chunk extracted it out of expository-chunk-grid.tsx).
 *
 * Verifies: the toggle reveals lead-in/citation fields and composes the
 * embedded preview; the preview adds NO quotation marks of its own (the
 * student places them — see lib/quotation-marks.ts) and prompts when a
 * complete pair is missing; toggling off is non-destructive (calls the
 * action with isQuotation:false, doesn't wipe stored fields); and the
 * read-only path (teacher review) hides the controls but keeps the preview.
 *
 * The server actions are mocked so the client component renders under jsdom
 * without pulling server-only modules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const setConcreteDetailQuotation = vi.fn().mockResolvedValue(undefined);
const updateConcreteDetail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/actions/t-charts", () => ({
  setConcreteDetailQuotation: (...args: unknown[]) =>
    setConcreteDetailQuotation(...args),
  updateConcreteDetail: (...args: unknown[]) => updateConcreteDetail(...args),
}));

import { CdEditor } from "@/components/student/writing/t-chart/cd-editor";
import { countQuotationMarks } from "@/lib/quotation-marks";
import type { ConcreteDetailData } from "@/lib/queries/t-charts";

function makeCd(overrides: Partial<ConcreteDetailData> = {}): ConcreteDetailData {
  return {
    id: "cd1",
    position: 0,
    text: "The narrator hesitates",
    is_quotation: false,
    transitional_lead_in: null,
    source_citation: null,
    ...overrides,
  } as ConcreteDetailData;
}

beforeEach(() => {
  setConcreteDetailQuotation.mockClear();
  updateConcreteDetail.mockClear();
});

describe("CdEditor — Embedding Quotations (TLCD)", () => {
  it("hides lead-in/citation until 'Mark as quotation' is checked", () => {
    render(<CdEditor writingId="w1" cd={makeCd()} disabled={false} />);

    expect(screen.queryByPlaceholderText(/Set up the quote/i)).toBeNull();
    expect(screen.queryByPlaceholderText("(Author 78)")).toBeNull();

    fireEvent.click(screen.getByLabelText(/Mark as quotation/i));

    expect(screen.getByPlaceholderText(/Set up the quote/i)).toBeTruthy();
    expect(screen.getByPlaceholderText("(Author 78)")).toBeTruthy();
  });

  it("persists the toggle via setConcreteDetailQuotation", async () => {
    render(<CdEditor writingId="w1" cd={makeCd()} disabled={false} />);
    fireEvent.click(screen.getByLabelText(/Mark as quotation/i));

    await waitFor(() =>
      expect(setConcreteDetailQuotation).toHaveBeenCalledWith("w1", "cd1", {
        isQuotation: true,
      })
    );
  });

  it("composes the embedded preview as lead-in quote (citation)", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({
          is_quotation: true,
          text: '"the woods are lovely"',
          transitional_lead_in: "As the traveler pauses,",
          source_citation: "(Frost 13)",
        })}
        disabled={false}
      />
    );

    const preview = screen.getByLabelText("Embedded quotation preview");
    expect(preview.textContent).toContain("As the traveler pauses,");
    expect(preview.textContent).toContain("the woods are lovely");
    expect(preview.textContent).toContain("(Frost 13)");
  });

  it("adds no quotation marks of its own — the student's text is verbatim", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({
          is_quotation: true,
          text: '"the woods are lovely"',
          source_citation: "(Frost 13)",
        })}
        disabled={false}
      />
    );

    const preview = screen.getByLabelText("Embedded quotation preview");
    // Exactly the two marks the student typed — no wrapping pair on top.
    expect(countQuotationMarks(preview.textContent ?? "")).toBe(2);
    expect(preview.textContent).not.toContain('""');
  });

  it("keeps a blended quotation intact instead of wrapping the whole CD", () => {
    // The guide's own p.79 example. The old preview turned this into
    // ""This "woman"…"" by wrapping text that was already quoted.
    const blended = 'This "fifty-five-year-old woman" with her "crutch"';
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({ is_quotation: true, text: blended })}
        disabled={false}
      />
    );

    const preview = screen.getByLabelText("Embedded quotation preview");
    expect(preview.textContent).toContain(blended);
    expect(countQuotationMarks(preview.textContent ?? "")).toBe(4);
  });

  it("prompts for quotation marks when the student hasn't added a pair", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({ is_quotation: true, text: "the woods are lovely" })}
        disabled={false}
      />
    );

    expect(screen.getByText(/Add .*quotation marks/i)).toBeTruthy();
  });

  it("drops the prompt once a complete pair is present", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({ is_quotation: true, text: '"the woods are lovely"' })}
        disabled={false}
      />
    );

    expect(screen.queryByText(/Add .*quotation marks/i)).toBeNull();
  });

  it("does not prompt on a plain CD that was never marked as a quotation", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({ text: "The narrator hesitates" })}
        disabled={false}
      />
    );

    expect(screen.queryByText(/Add .*quotation marks/i)).toBeNull();
  });

  it("toggling off is non-destructive — sends isQuotation:false only", async () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({
          is_quotation: true,
          transitional_lead_in: "Although it is late,",
          source_citation: "(Frost 13)",
        })}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByLabelText(/Mark as quotation/i));

    await waitFor(() =>
      expect(setConcreteDetailQuotation).toHaveBeenCalledWith("w1", "cd1", {
        isQuotation: false,
      })
    );
    // No transitionalLeadIn / sourceCitation in the payload → stored values kept.
    const payload = setConcreteDetailQuotation.mock.calls[0][2];
    expect(payload).not.toHaveProperty("transitionalLeadIn");
    expect(payload).not.toHaveProperty("sourceCitation");
  });

  it("read-only hides the controls but keeps the preview", () => {
    render(
      <CdEditor
        writingId="w1"
        cd={makeCd({
          is_quotation: true,
          text: "the woods are lovely",
          source_citation: "(Frost 13)",
        })}
        disabled
      />
    );

    // Toggle + fields are disabled in the teacher-review render...
    expect(
      (screen.getByLabelText(/Mark as quotation/i) as HTMLInputElement).disabled
    ).toBe(true);
    // ...but the assembled quote still shows read-only.
    expect(screen.getByLabelText("Embedded quotation preview")).toBeTruthy();
  });
});
