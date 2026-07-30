/**
 * Rubric shape + validation for the assignments.rubric JSONB column.
 *
 * The criterion-level `description` field was removed — a criterion is now
 * just its Specific Skill (e.g., Addressing the Prompt) plus its levels.
 * These tests pin the two halves of that change: a description is no longer
 * required to save, and a rubric written before the removal still loads.
 */

import { describe, it, expect } from "vitest";
import {
  applyScale,
  DEFAULT_SCALE,
  deriveScale,
  emptyRubric,
  loadRubric,
  newCriterion,
  scaleToLevels,
  validateRubric,
  type Rubric,
} from "@/lib/rubric";

function rubric(name: string): Rubric {
  return {
    criteria: [
      {
        id: "crit-1",
        name,
        levels: [
          { score: 4, label: "Exemplary", description: "" },
          { score: 1, label: "Beginning", description: "" },
        ],
      },
    ],
  };
}

describe("newCriterion", () => {
  it("starts with an empty skill name and the default 0-based scale", () => {
    const c = newCriterion();

    expect(c.name).toBe("");
    expect(c.levels.map((l) => l.score)).toEqual([3, 2, 1, 0]);
    expect(c.levels.map((l) => l.label)).toEqual(DEFAULT_SCALE.labels);
    expect(c).not.toHaveProperty("description");
  });

  it("takes the rubric's scale when one is supplied", () => {
    const c = newCriterion({ labels: ["Yes", "No"], lowestScore: 1 });

    expect(c.levels).toEqual([
      { score: 2, label: "Yes", description: "" },
      { score: 1, label: "No", description: "" },
    ]);
  });

  it("gives each criterion its own id", () => {
    expect(newCriterion().id).not.toBe(newCriterion().id);
  });
});

describe("scaleToLevels", () => {
  it("numbers levels down to the chosen lowest score", () => {
    const zeroBased = scaleToLevels({ labels: ["A", "B", "C"], lowestScore: 0 });
    const oneBased = scaleToLevels({ labels: ["A", "B", "C"], lowestScore: 1 });

    expect(zeroBased.map((l) => l.score)).toEqual([2, 1, 0]);
    expect(oneBased.map((l) => l.score)).toEqual([3, 2, 1]);
  });

  it("handles a scale of any size, not just four", () => {
    const six = scaleToLevels({
      labels: ["A", "B", "C", "D", "E", "F"],
      lowestScore: 0,
    });

    expect(six.map((l) => l.score)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("carries descriptions forward by rank, not by score", () => {
    const existing = [
      { score: 3, label: "Exemplary", description: "top" },
      { score: 2, label: "Proficient", description: "next" },
    ];
    // Same ranks, renumbered because the floor moved 0 -> 1.
    const next = scaleToLevels(
      { labels: ["Exemplary", "Proficient"], lowestScore: 1 },
      existing
    );

    expect(next).toEqual([
      { score: 2, label: "Exemplary", description: "top" },
      { score: 1, label: "Proficient", description: "next" },
    ]);
  });
});

describe("deriveScale", () => {
  it("reads the scale back off saved criteria", () => {
    const value = rubric("Addressing the Prompt");

    expect(deriveScale(value.criteria)).toEqual({
      labels: ["Exemplary", "Beginning"],
      lowestScore: 1,
    });
  });

  it("falls back to the default for an empty rubric", () => {
    expect(deriveScale([])).toEqual(DEFAULT_SCALE);
  });
});

describe("applyScale", () => {
  it("re-cuts every criterion and keeps their descriptions", () => {
    const criteria = [
      { ...newCriterion(), name: "Thesis Statement" },
      { ...newCriterion(), name: "Concrete Detail" },
    ];
    criteria[0]!.levels[0]!.description = "top of the first";

    const next = applyScale(criteria, { labels: ["Met", "Not"], lowestScore: 0 });

    expect(next).toHaveLength(2);
    for (const c of next) {
      expect(c.levels.map((l) => l.score)).toEqual([1, 0]);
      expect(c.levels.map((l) => l.label)).toEqual(["Met", "Not"]);
    }
    expect(next[0]!.levels[0]!.description).toBe("top of the first");
    expect(next[0]!.name).toBe("Thesis Statement");
  });
});

describe("validateRubric", () => {
  it("accepts a criterion with no description", () => {
    const result = validateRubric(rubric("Addressing the Prompt"));

    expect(result.ok).toBe(true);
  });

  it("still requires the specific skill", () => {
    const result = validateRubric(rubric("   "));

    expect(result).toEqual({
      ok: false,
      error: "Criterion 1: specific skill is required.",
    });
  });

  it("still requires a label on every level", () => {
    const value = rubric("Thesis Statement");
    value.criteria[0]!.levels[1]!.label = "";

    expect(validateRubric(value)).toEqual({
      ok: false,
      error: "Criterion 1 level 2: label is required.",
    });
  });

  it("still requires at least one level", () => {
    const value = rubric("Concrete Detail");
    value.criteria[0]!.levels = [];

    expect(validateRubric(value)).toEqual({
      ok: false,
      error: "Criterion 1: at least one level is required.",
    });
  });

  it("treats null as an empty rubric", () => {
    expect(validateRubric(null)).toEqual({ ok: true, value: emptyRubric() });
  });
});

describe("loadRubric", () => {
  it("keeps a criterion saved before description was removed", () => {
    const legacy = {
      criteria: [
        {
          id: "crit-legacy",
          name: "Thesis Statement",
          description: "What this criterion measures.",
          levels: [{ score: 4, label: "Exemplary", description: "" }],
        },
      ],
    };

    expect(loadRubric(legacy).criteria).toHaveLength(1);
    expect(loadRubric(legacy).criteria[0]!.name).toBe("Thesis Statement");
  });

  it("drops malformed criteria rather than throwing", () => {
    const raw = {
      criteria: [{ id: "no-levels", name: "Broken" }, ...rubric("Good").criteria],
    };

    expect(loadRubric(raw).criteria.map((c) => c.name)).toEqual(["Good"]);
  });

  it("collapses null and malformed input to an empty rubric", () => {
    expect(loadRubric(null)).toEqual(emptyRubric());
    expect(loadRubric("nope")).toEqual(emptyRubric());
    expect(loadRubric({ criteria: "nope" })).toEqual(emptyRubric());
  });
});
