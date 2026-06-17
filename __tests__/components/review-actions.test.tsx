/**
 * Locks the "feedback is optional when returning" rule. A teacher may send a
 * writing back for revision without leaving any feedback — the Return control
 * is never gated on a feedback count. See review-actions.tsx / the product
 * decision that overall feedback text is optional.
 *
 * Server actions and the rubric panel are mocked so the client component
 * renders under jsdom without pulling server-only modules.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/teacher-review", () => ({
  returnWriting: vi.fn(),
  gradeWriting: vi.fn(),
}));
vi.mock("@/components/dashboard/writing-review/rubric-scoring-panel", () => ({
  RubricScoringPanel: () => null,
}));

import { ReviewActions } from "@/components/dashboard/writing-review/review-actions";

describe("ReviewActions — feedback optional on return", () => {
  it("enables 'Return for revision' even with no feedback", () => {
    render(
      <ReviewActions
        writingId="w1"
        status="submitted"
        rubric={null}
        hasFinalDraft={false}
      />
    );
    const btn = screen.getByRole("button", { name: /return for revision/i });
    expect(btn).toBeEnabled();
    // No "add feedback first" gating hint.
    expect(btn).not.toHaveAttribute("title");
  });

  it("hides the Return control once the writing is graded (terminal)", () => {
    render(
      <ReviewActions
        writingId="w1"
        status="graded"
        rubric={null}
        hasFinalDraft={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /return for revision/i })
    ).not.toBeInTheDocument();
  });
});
