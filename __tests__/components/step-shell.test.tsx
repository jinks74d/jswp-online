/**
 * Tests for StepShell — the scaffold nine step screens share.
 *
 * Worth pinning tightly because a regression here breaks every mode at once,
 * and because `components/student/` is otherwise ~4% covered. The behaviours
 * that matter are the ones the nine hand-written copies all had: tabs only
 * when there is more than one paragraph, Continue disabled by the gate, the
 * terminal step relabelling, and read-only hiding the whole footer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StepShell, type StepGate } from "@/components/student/writing/step-shell";

/* The shell reads writing mode from context and renders SubmitStepButton,
 * which calls a server action. Both are stubbed so these tests exercise the
 * scaffold rather than the data layer. */
const writingMode = {
  isReadOnly: false,
  submittedSteps: new Map<string, string>(),
  printMeta: null,
};

vi.mock("@/components/student/writing/use-writing-mode", () => ({
  useWritingMode: () => writingMode,
}));

vi.mock("@/components/student/writing/submit-step-button", () => ({
  SubmitStepButton: ({ isTerminal }: { isTerminal?: boolean }) =>
    isTerminal ? null : <button type="button">Submit this step</button>,
}));

interface Bp {
  id: string;
  position: number;
}

const BPS: Bp[] = [
  { id: "bp-1", position: 1 },
  { id: "bp-2", position: 2 },
  { id: "bp-3", position: 3 },
];

const READY: StepGate = { canContinue: true, message: "3 body paragraphs ready" };
const BLOCKED: StepGate = {
  canContinue: false,
  message: "Body paragraph 2 needs at least one concrete detail.",
};

function renderShell(over: Partial<React.ComponentProps<typeof StepShell<Bp>>> = {}) {
  const onContinue = vi.fn();
  const props = {
    writingId: "w1",
    stepKey: "expository.t_chart",
    items: BPS,
    itemKey: (b: Bp) => b.id,
    tabLabel: (b: Bp) => `Body ${b.position}`,
    renderPane: (b: Bp) => <div>pane for {b.position}</div>,
    gate: READY,
    onContinue,
    pending: false,
    error: null,
    ...over,
  };
  render(<StepShell<Bp> {...props} />);
  return { onContinue };
}

beforeEach(() => {
  writingMode.isReadOnly = false;
  cleanup();
});

describe("StepShell — body paragraph tabs", () => {
  it("renders one tab per paragraph and shows the first pane", () => {
    renderShell();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByText("pane for 1")).toBeInTheDocument();
  });

  it("switches panes when another tab is clicked", () => {
    renderShell();

    fireEvent.click(screen.getByRole("tab", { name: "Body 3" }));

    expect(screen.getByText("pane for 3")).toBeInTheDocument();
    expect(screen.queryByText("pane for 1")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Body 3" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("hides the tablist entirely for a single paragraph", () => {
    // One tab is noise, not navigation.
    renderShell({ items: [BPS[0]] });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByText("pane for 1")).toBeInTheDocument();
  });

  it("labels the tablist for screen readers", () => {
    renderShell();
    expect(
      screen.getByRole("tablist", { name: "Body paragraphs" })
    ).toBeInTheDocument();
  });

  it("lets the caller name tabs, which narrative needs", () => {
    renderShell({ tabLabel: (b) => `Chapter ${b.position}` });
    expect(screen.getByRole("tab", { name: "Chapter 2" })).toBeInTheDocument();
  });
});

describe("StepShell — empty state", () => {
  it("shows the empty message when there are no paragraphs", () => {
    renderShell({ items: [] });
    expect(
      screen.getByText("No body paragraphs yet. Reload to bootstrap.")
    ).toBeInTheDocument();
  });

  it("lets the caller override the empty message", () => {
    renderShell({ items: [], emptyMessage: "No body paragraphs yet." });
    expect(screen.getByText("No body paragraphs yet.")).toBeInTheDocument();
  });
});

describe("StepShell — the gate", () => {
  it("shows the gate message verbatim, without rephrasing it", () => {
    // The shell must never reword pedagogy — see the module comment.
    renderShell({ gate: BLOCKED });
    expect(screen.getByText(BLOCKED.message)).toBeInTheDocument();
  });

  it("disables Continue when the gate blocks", () => {
    renderShell({ gate: BLOCKED });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("enables Continue when the gate passes", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("calls onContinue when Continue is clicked", () => {
    const { onContinue } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not call onContinue while blocked", () => {
    const { onContinue } = renderShell({ gate: BLOCKED });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe("StepShell — pending and error", () => {
  it("disables Continue and relabels it while saving", () => {
    renderShell({ pending: true });
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  });

  it("shows an error as an alert", () => {
    renderShell({ error: "Could not continue." });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not continue.");
  });

  it("renders no alert when there is no error", () => {
    renderShell();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("StepShell — terminal step", () => {
  it('reads "Submit" rather than "Continue"', () => {
    renderShell({ isTerminal: true });
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();
  });

  it('says "Submitting…" while pending', () => {
    renderShell({ isTerminal: true, pending: true });
    expect(screen.getByRole("button", { name: /Submitting/ })).toBeDisabled();
  });

  it("hides the separate [Submit this step] button", () => {
    // Two adjacent buttons both saying "submit" different things is how a
    // student submits the wrong one.
    renderShell({ isTerminal: true });
    expect(
      screen.queryByRole("button", { name: "Submit this step" })
    ).not.toBeInTheDocument();
  });

  it("shows [Submit this step] on a non-terminal step", () => {
    renderShell();
    expect(
      screen.getByRole("button", { name: "Submit this step" })
    ).toBeInTheDocument();
  });
});

describe("StepShell — read-only", () => {
  it("hides the whole footer for a teacher reviewing the writing", () => {
    writingMode.isReadOnly = true;
    renderShell({ gate: BLOCKED });

    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(BLOCKED.message)).not.toBeInTheDocument();
  });

  it("still renders the panes and tabs in read-only", () => {
    writingMode.isReadOnly = true;
    renderShell();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByText("pane for 1")).toBeInTheDocument();
  });
});

describe("StepShell — reference column", () => {
  it("omits both reference regions when no reference is given", () => {
    renderShell();
    expect(screen.queryByText("Source text & annotations")).not.toBeInTheDocument();
  });

  it("renders the reference twice — mobile disclosure and desktop aside", () => {
    // Both exist in the DOM at once; CSS decides which is visible. Asserting
    // the count guards against a migration dropping one breakpoint.
    renderShell({ reference: <div>REFERENCE</div> });
    expect(screen.getAllByText("REFERENCE")).toHaveLength(2);
    expect(screen.getByText("Source text & annotations")).toBeInTheDocument();
  });
});
