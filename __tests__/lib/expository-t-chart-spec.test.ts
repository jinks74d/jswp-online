/**
 * Unit coverage for chunk 4.5d-2 — the Expository T-Chart layout spec.
 * Verifies the ratio → header-step-number and ratio → badge-set
 * mapping that drives ExpositoryTChart / ExpositoryChunkGrid.
 */

import { describe, it, expect } from "vitest";
import { getExpositoryTChartSpec } from "@/lib/expository-t-chart-spec";

describe("getExpositoryTChartSpec — 2+:1", () => {
  const spec = getExpositoryTChartSpec("two_plus_to_one");

  it("uses STEP 4 in the header band", () => {
    expect(spec.stepNumber).toBe(4);
    expect(spec.ratioLabel).toBe("(2+:1)");
  });

  it("renders 5 badges: TS, CDs, CMs, Revised TS, CS", () => {
    expect(spec.badges).toEqual({ ts: 1, cds: 2, cms: 3, revised_ts: 4, cs: 5 });
    expect(Object.keys(spec.badges)).toHaveLength(5);
  });

  it("shows the Revised TS row and the CM column", () => {
    expect(spec.showRevisedTs).toBe(true);
    expect(spec.showCmColumn).toBe(true);
  });

  it("uses abbreviated TS/CS labels", () => {
    expect(spec.tsLabel).toBe("TS:");
    expect(spec.csLabel).toBe("CS:");
  });
});

describe("getExpositoryTChartSpec — 3+:0", () => {
  const spec = getExpositoryTChartSpec("three_plus_to_zero");

  it("uses STEP 3 in the header band (no gather_cds step at 3+:0)", () => {
    expect(spec.stepNumber).toBe(3);
    expect(spec.ratioLabel).toBe("(3+:0)");
  });

  it("renders 3 badges: TS, CDs, CS — no CM badge", () => {
    expect(spec.badges).toEqual({ ts: 1, cds: 2, cs: 3 });
    expect(Object.keys(spec.badges)).toHaveLength(3);
    expect(spec.badges.cms).toBeUndefined();
  });

  it("hides the Revised TS row and the CM column", () => {
    expect(spec.showRevisedTs).toBe(false);
    expect(spec.showCmColumn).toBe(false);
  });

  it("uses full-word TOPIC SENTENCE / CONCLUDING SENTENCE labels", () => {
    expect(spec.tsLabel).toBe("TOPIC SENTENCE:");
    expect(spec.csLabel).toBe("CONCLUDING SENTENCE:");
  });
});
