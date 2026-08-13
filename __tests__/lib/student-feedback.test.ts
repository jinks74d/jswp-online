import { describe, it, expect } from "vitest";
import { hasNewFeedback, byFeedbackFirst } from "@/lib/student-feedback";

const none = { total: 0, unresolved: 0 };

describe("hasNewFeedback", () => {
  it("catches feedback on an IN-PROGRESS writing", () => {
    // The reported bug: the Feedback tab filtered on status === "returned",
    // so a note left by per-step grading sorted into "In progress" instead.
    expect(
      hasNewFeedback({
        status: "in_progress",
        feedback: { total: 1, unresolved: 1 },
      })
    ).toBe(true);
  });

  it("catches feedback on a SUBMITTED writing", () => {
    expect(
      hasNewFeedback({
        status: "submitted",
        feedback: { total: 2, unresolved: 2 },
      })
    ).toBe(true);
  });

  it("includes every returned writing, even with no written note", () => {
    // Returning is itself a request for changes.
    expect(hasNewFeedback({ status: "returned", feedback: none })).toBe(true);
    expect(hasNewFeedback({ status: "returned", feedback: null })).toBe(true);
  });

  it("drops graded work once the notes have been worked through", () => {
    expect(
      hasNewFeedback({ status: "graded", feedback: { total: 6, unresolved: 0 } })
    ).toBe(false);
  });

  it("keeps graded work that still has unresolved notes", () => {
    expect(
      hasNewFeedback({ status: "graded", feedback: { total: 6, unresolved: 2 } })
    ).toBe(true);
  });

  it("is false for untouched assignments", () => {
    expect(hasNewFeedback({ status: "not_started", feedback: null })).toBe(false);
    expect(hasNewFeedback({ status: "in_progress", feedback: none })).toBe(false);
  });
});

describe("byFeedbackFirst", () => {
  const waiting = {
    id: "waiting",
    status: "in_progress",
    feedback: { total: 1, unresolved: 1 },
  };
  const quiet = { id: "quiet", status: "in_progress", feedback: none };
  const alsoQuiet = { id: "alsoQuiet", status: "graded", feedback: none };

  it("floats assignments with feedback to the front", () => {
    const sorted = [quiet, waiting].sort(byFeedbackFirst);
    expect(sorted.map((x) => x.id)).toEqual(["waiting", "quiet"]);
  });

  it("preserves the incoming order among equals (stable)", () => {
    // The list arrives sorted by due date; feedback reorders only across the
    // boundary, never within it.
    const sorted = [quiet, alsoQuiet].sort(byFeedbackFirst);
    expect(sorted.map((x) => x.id)).toEqual(["quiet", "alsoQuiet"]);
  });

  it("leaves an all-feedback list untouched", () => {
    const a = { id: "a", status: "returned", feedback: none };
    const b = { id: "b", status: "returned", feedback: none };
    expect([a, b].sort(byFeedbackFirst).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
