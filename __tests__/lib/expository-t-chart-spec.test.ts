/**
 * Unit coverage for chunk 4.5d-2 — the Expository T-Chart layout spec.
 * Verifies the ratio → header-step-number and ratio → badge-set
 * mapping that drives ExpositoryTChart / ExpositoryChunkGrid.
 */

import { describe, it, expect } from "vitest";
import { getExpositoryTChartSpec } from "@/lib/expository-t-chart-spec";

const STANDARD_BADGES = {
  ts: 1,
  cds: 2,
  cms: 3,
  revised_ts: 4,
  cm_sentence: 5,
  cs: 6,
};

describe("getExpositoryTChartSpec — 2+:1", () => {
  const spec = getExpositoryTChartSpec("nonlit_expository_two_plus_to_one");

  it("uses STEP 4 in the header band", () => {
    expect(spec.stepNumber).toBe(4);
    expect(spec.ratioLabel).toBe("(2+:1)");
  });

  it("renders 6 badges: TS, CDs, CMs, Revised TS, Commentary, CS", () => {
    expect(spec.badges).toEqual(STANDARD_BADGES);
    expect(Object.keys(spec.badges)).toHaveLength(6);
  });

  it("orders the three Pick-n-Stitch regions after the CD/CM work", () => {
    // The student writes the Revised TS, the CM sentence and the CS from
    // commentary words they have not spent yet, so all three must be
    // numbered after the CMs (3) even though the Revised TS sits second
    // from the top on the printed sheet.
    const { cms, revised_ts, cm_sentence, cs } = spec.badges;
    expect(revised_ts).toBeGreaterThan(cms!);
    expect(cm_sentence).toBeGreaterThan(revised_ts!);
    expect(cs).toBeGreaterThan(cm_sentence!);
  });

  it("shows the Revised TS row, the CM column and the CM sentence row", () => {
    expect(spec.showRevisedTs).toBe(true);
    expect(spec.showCmColumn).toBe(true);
    expect(spec.showCmSentence).toBe(true);
  });

  it("names the first TS the throwaway draft and tags the CS", () => {
    expect(spec.tsLabel).toBe("Throwaway Topic Sentence (TS):");
    expect(spec.csLabel).toBe("Concluding Sentence (CS):");
  });

  it("keeps ellipses out of the labels", () => {
    expect(spec.tsLabel).not.toContain("…");
    expect(spec.csLabel).not.toContain("…");
    expect(spec.csLabel).not.toContain("...");
  });
});

describe("getExpositoryTChartSpec — 1:1", () => {
  const spec = getExpositoryTChartSpec("nonlit_expository_one_to_one");

  it("labels the ratio (1:1) but keeps the STEP 4 standard layout", () => {
    expect(spec.stepNumber).toBe(4);
    expect(spec.ratioLabel).toBe("(1:1)");
  });

  it("renders the same 6 badges as 2+:1", () => {
    expect(spec.badges).toEqual(STANDARD_BADGES);
  });

  it("shows the Revised TS row, CM column and CM sentence (it has commentary)", () => {
    expect(spec.showRevisedTs).toBe(true);
    expect(spec.showCmColumn).toBe(true);
    expect(spec.showCmSentence).toBe(true);
  });
});

describe("getExpositoryTChartSpec — 3+:0", () => {
  const spec = getExpositoryTChartSpec("nonlit_summary_three_plus_to_zero");

  it("uses STEP 3 in the header band (no gather_cds step at 3+:0)", () => {
    expect(spec.stepNumber).toBe(3);
    expect(spec.ratioLabel).toBe("(3+:0)");
  });

  it("renders 3 badges: TS, CDs, CS — no CM badges", () => {
    expect(spec.badges).toEqual({ ts: 1, cds: 2, cs: 3 });
    expect(Object.keys(spec.badges)).toHaveLength(3);
    expect(spec.badges.cms).toBeUndefined();
    expect(spec.badges.cm_sentence).toBeUndefined();
  });

  it("hides the Revised TS row, the CM column and the CM sentence row", () => {
    expect(spec.showRevisedTs).toBe(false);
    expect(spec.showCmColumn).toBe(false);
    expect(spec.showCmSentence).toBe(false);
  });

  it("uses full-word TOPIC SENTENCE / CONCLUDING SENTENCE labels", () => {
    expect(spec.tsLabel).toBe("Topic Sentence:");
    expect(spec.csLabel).toBe("Concluding Sentence:");
  });
});
