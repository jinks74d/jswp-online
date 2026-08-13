/**
 * Covers the shared CdEditor's Embedding-Quotations (TLCD) affordance, now
 * used by expository AND argumentation/literary T-Charts (the "mirror TLCD UI"
 * chunk extracted it out of expository-chunk-grid.tsx).
 *
 * Verifies: the toggle reveals lead-in/citation fields; a missing quotation
 * pair is prompted for (the student places the marks — see
 * lib/quotation-marks.ts); toggling off is non-destructive (calls the action
 * with isQuotation:false, doesn't wipe stored fields); and the read-only path
 * (teacher review) disables the controls.
 *
 * The assembled-quotation preview was removed 2026-08-13 — the student weaves
 * lead-in, quote and citation together on the Shaping Sheet, so a
 * machine-composed version here pre-empted the exercise.
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

  it("shows no assembled-quotation preview", () => {
    // Removed deliberately; this guards against it creeping back into the
    // T-Chart's left column.
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

    expect(screen.queryByLabelText("Embedded quotation preview")).toBeNull();
    expect(screen.queryByText(/^Embedded$/)).toBeNull();
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

  it("read-only disables the controls", () => {
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

    // Toggle + fields are disabled in the teacher-review render.
    expect(
      (screen.getByLabelText(/Mark as quotation/i) as HTMLInputElement).disabled
    ).toBe(true);
  });
});
