import { describe, it, expect } from "vitest";
import {
  hasRevisedSinceReturned,
  byRevisedThenRecent,
} from "@/lib/revision-signal";

const RETURNED = "2026-08-10T12:00:00Z";
const BEFORE = "2026-08-09T09:00:00Z";
const AFTER = "2026-08-11T15:00:00Z";

function w(over: Partial<Parameters<typeof hasRevisedSinceReturned>[0]> = {}) {
  return {
    status: "returned",
    returned_at: RETURNED,
    last_student_edit_at: AFTER,
    ...over,
  };
}

describe("hasRevisedSinceReturned", () => {
  it("flags a returned writing edited after it was sent back", () => {
    expect(hasRevisedSinceReturned(w())).toBe(true);
  });

  it("does not flag edits that predate the return", () => {
    // The student's work before feedback is not a revision.
    expect(hasRevisedSinceReturned(w({ last_student_edit_at: BEFORE }))).toBe(
      false
    );
  });

  it("does not flag a writing with no recorded student edit", () => {
    // NULL means "never captured" — pre-0054 rows included. Claiming a
    // revision there would be a lie the teacher learns to distrust.
    expect(
      hasRevisedSinceReturned(w({ last_student_edit_at: null }))
    ).toBe(false);
  });

  it("stays quiet once the student re-submits", () => {
    // The status change is itself the signal, and it belongs in Submitted.
    expect(hasRevisedSinceReturned(w({ status: "submitted" }))).toBe(false);
  });

  it("stays quiet on graded and in-progress writings", () => {
    expect(hasRevisedSinceReturned(w({ status: "graded" }))).toBe(false);
    expect(hasRevisedSinceReturned(w({ status: "in_progress" }))).toBe(false);
  });

  it("does not flag when returned_at is missing", () => {
    expect(hasRevisedSinceReturned(w({ returned_at: null }))).toBe(false);
  });

  it("treats an edit exactly at the return instant as not a revision", () => {
    // Returning writes returned_at and can coincide with a trailing student
    // save; strict > keeps that from reading as new work.
    expect(
      hasRevisedSinceReturned(w({ last_student_edit_at: RETURNED }))
    ).toBe(false);
  });
});

describe("byRevisedThenRecent", () => {
  const revisedOld = { ...w({ last_student_edit_at: "2026-08-11T01:00:00Z" }), updated_at: RETURNED };
  const revisedNew = { ...w({ last_student_edit_at: "2026-08-12T01:00:00Z" }), updated_at: RETURNED };
  const untouched = { ...w({ last_student_edit_at: null }), updated_at: "2026-08-13T01:00:00Z" };

  it("puts revised writings ahead of untouched ones", () => {
    // Even though `untouched` has the most recent updated_at — a teacher write
    // must not outrank actual student work.
    const sorted = [untouched, revisedOld].sort(byRevisedThenRecent);
    expect(sorted[0]).toBe(revisedOld);
  });

  it("orders revised writings most-recently-edited first", () => {
    const sorted = [revisedOld, revisedNew].sort(byRevisedThenRecent);
    expect(sorted[0]).toBe(revisedNew);
  });

  it("falls back to updated_at when there is no student edit", () => {
    const older = { ...w({ last_student_edit_at: null }), updated_at: "2026-08-01T00:00:00Z" };
    const sorted = [older, untouched].sort(byRevisedThenRecent);
    expect(sorted[0]).toBe(untouched);
  });
});
