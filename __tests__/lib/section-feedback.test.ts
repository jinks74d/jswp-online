/**
 * Unit coverage for groupSectionFeedback — splitting a writing's
 * teacher_feedback rows into per-section notes + the overall thread.
 */

import { describe, it, expect } from "vitest";
import { groupSectionFeedback } from "@/lib/section-feedback";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

function row(partial: Partial<FeedbackItemRow>): FeedbackItemRow {
  return {
    id: "id",
    student_writing_id: "w",
    teacher_id: "t",
    target_kind: "student_writing",
    target_id: "w",
    body: "x",
    step_key: null,
    grade_value: null,
    rubric_score: null,
    is_resolved: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    author: null,
    ...partial,
  };
}

describe("groupSectionFeedback", () => {
  it("splits section notes (by step_key) from overall (null step_key)", () => {
    const { byStep, overall } = groupSectionFeedback([
      row({ id: "a", step_key: "expository.t_chart", body: "tc" }),
      row({ id: "b", step_key: null, body: "overall" }),
    ]);
    expect(byStep.get("expository.t_chart")?.body).toBe("tc");
    expect(byStep.size).toBe(1);
    expect(overall.map((r) => r.id)).toEqual(["b"]);
  });

  it("keeps the newest when a step has duplicate notes", () => {
    const { byStep } = groupSectionFeedback([
      row({ id: "old", step_key: "s", created_at: "2026-01-01T00:00:00Z", body: "old" }),
      row({ id: "new", step_key: "s", created_at: "2026-02-01T00:00:00Z", body: "new" }),
    ]);
    expect(byStep.get("s")?.body).toBe("new");
  });

  it("returns empty groups for no rows", () => {
    const { byStep, overall } = groupSectionFeedback([]);
    expect(byStep.size).toBe(0);
    expect(overall).toEqual([]);
  });
});
