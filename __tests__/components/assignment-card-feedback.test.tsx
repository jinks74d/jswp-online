/**
 * The student assignment card's feedback line. The bug this guards against:
 * a teacher who graded left notes the student was never told about, because
 * the hint only rendered for `returned`.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssignmentCard } from "@/components/student/assignment-card";
import type { StudentAssignmentListItem } from "@/lib/queries/student-assignments";

function item(
  over: Partial<StudentAssignmentListItem> = {}
): StudentAssignmentListItem {
  return {
    id: "a1",
    title: "Yukon One-Chunk Paragraph",
    mode: "expository",
    due_at: null,
    released_at: "2026-08-01T00:00:00Z",
    status: "returned",
    writing: {
      id: "w1",
      draft_number: 1,
      status: "returned",
      submitted_at: null,
      graded_at: null,
      total_score: null,
    },
    ...over,
  } as StudentAssignmentListItem;
}

describe("AssignmentCard feedback line", () => {
  it("counts unresolved items on a returned assignment", () => {
    render(
      <AssignmentCard item={item()} feedback={{ total: 5, unresolved: 3 }} />
    );
    expect(screen.getByText("3 feedback items waiting")).toBeInTheDocument();
  });

  it("tells a returned student when they've addressed everything", () => {
    render(
      <AssignmentCard item={item()} feedback={{ total: 4, unresolved: 0 }} />
    );
    expect(
      screen.getByText("All feedback addressed — re-submit when ready")
    ).toBeInTheDocument();
  });

  it("still says feedback is waiting when returned with no written note", () => {
    render(<AssignmentCard item={item()} feedback={null} />);
    expect(screen.getByText("Feedback waiting")).toBeInTheDocument();
  });

  it("surfaces feedback on a GRADED assignment — the bug this fixes", () => {
    // Previously rendered nothing at all, so a graded student never learned
    // their teacher had written anything.
    render(
      <AssignmentCard
        item={item({ status: "graded" })}
        feedback={{ total: 2, unresolved: 0 }}
      />
    );
    expect(screen.getByText("Teacher feedback · 2 notes")).toBeInTheDocument();
  });

  it("uses the TOTAL on graded work, not the unresolved count", () => {
    // unresolved falls to zero as the student ticks items off; using it here
    // would make the teacher's notes vanish from the card.
    render(
      <AssignmentCard
        item={item({ status: "graded" })}
        feedback={{ total: 1, unresolved: 0 }}
      />
    );
    expect(screen.getByText("Teacher feedback · 1 note")).toBeInTheDocument();
  });

  it("says nothing on a graded assignment with no feedback", () => {
    render(
      <AssignmentCard
        item={item({ status: "graded" })}
        feedback={{ total: 0, unresolved: 0 }}
      />
    );
    expect(screen.queryByText(/feedback/i)).toBeNull();
  });

  it("stays silent while the writing is still submitted", () => {
    // RLS would let the student read these rows; this gate is what stops them
    // seeing a teacher's half-written notes mid-review.
    render(
      <AssignmentCard
        item={item({ status: "submitted" })}
        feedback={{ total: 3, unresolved: 3 }}
      />
    );
    expect(screen.queryByText(/feedback/i)).toBeNull();
  });

  it("stays silent on work not yet started", () => {
    render(
      <AssignmentCard
        item={item({ status: "not_started", writing: null })}
        feedback={null}
      />
    );
    expect(screen.queryByText(/feedback/i)).toBeNull();
  });
});
