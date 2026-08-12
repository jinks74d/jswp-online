import { describe, it, expect } from "vitest";
import { orderStepsForReview } from "@/lib/review-order";
import { getSteps, type JswpMode } from "@/lib/jswp-modes";

const PARAGRAPH_CTX = {
  isEssay: false,
  hasCounterargument: false,
  hasSourceText: true,
  chunkRatio: "nonlit_expository_two_plus_to_one" as const,
};

const ESSAY_CTX = { ...PARAGRAPH_CTX, isEssay: true };

describe("orderStepsForReview", () => {
  it("leads a single-paragraph expository with The Final Paragraph", () => {
    const steps = getSteps("expository", PARAGRAPH_CTX);
    const { outcome, process } = orderStepsForReview(steps);

    expect(outcome.map((s) => s.label)).toEqual(["The Final Paragraph"]);
    // The thing she actually came to read is no longer under six sections.
    expect(process[0]?.label).toBe("Decode the Prompt");
  });

  it("puts the Final Draft ahead of the paragraph forms on an essay", () => {
    const steps = getSteps("expository", ESSAY_CTX);
    const { outcome } = orderStepsForReview(steps);

    expect(outcome.map((s) => s.groupOrigin)).toEqual([
      "final_draft",
      "paragraph_form",
    ]);
  });

  it("keeps the process in the student's own sequence", () => {
    const steps = getSteps("expository", PARAGRAPH_CTX);
    const { process } = orderStepsForReview(steps);
    const original = steps
      .filter((s) => s.groupOrigin !== "paragraph_form")
      .map((s) => s.key);

    expect(process.map((s) => s.key)).toEqual(original);
  });

  it("loses no steps and duplicates none, in every mode", () => {
    for (const mode of [
      "expository",
      "argumentation",
      "literary",
      "narrative",
    ] as JswpMode[]) {
      for (const ctx of [PARAGRAPH_CTX, ESSAY_CTX]) {
        const steps = getSteps(mode, ctx);
        const { outcome, process } = orderStepsForReview(steps);
        const keys = [...outcome, ...process].map((s) => s.key);

        expect(new Set(keys).size, `${mode} duplicates`).toBe(keys.length);
        expect([...keys].sort(), `${mode} coverage`).toEqual(
          steps.map((s) => s.key).sort()
        );
      }
    }
  });

  it("handles a step list with no outcome steps at all", () => {
    const { outcome, process } = orderStepsForReview([
      { groupOrigin: "decode_prompt" },
      { groupOrigin: "t_chart" },
    ]);
    expect(outcome).toEqual([]);
    expect(process).toHaveLength(2);
  });
});
