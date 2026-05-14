/**
 * Pure layout spec for the Expository T-Chart (chunk 4.5d-2). Maps the
 * writing's chunk ratio to the guide-faithful header/badge/label
 * configuration so the rendering components don't ratio-branch inline.
 *
 * No React, no server-only — unit-tested in
 * __tests__/lib/expository-t-chart-spec.test.ts.
 *
 * Source: docs/reference/expository-organizer-specs.md — "T-Chart 2+:1"
 * and "T-Chart 3+:0". The 3+:0 step number is 3 (not 4) because 4.5d-1
 * dropped the gather_cds step at 3+:0.
 */

import type { ChunkRatio } from "@/lib/jswp-modes";

export type TChartRegion = "ts" | "revised_ts" | "cds" | "cms" | "cs";

export interface ExpositoryTChartSpec {
  /** Header band: "STEP {stepNumber}: COMPLETING THE T-CHART". */
  readonly stepNumber: 3 | 4;
  /** Title ratio label, e.g. "(2+:1)". */
  readonly ratioLabel: string;
  /** Numbered order badges per region, in JSWP completion order. */
  readonly badges: Readonly<Partial<Record<TChartRegion, number>>>;
  /** 2+:1 has a Revised TS row; 3+:0 has nothing to revise from. */
  readonly showRevisedTs: boolean;
  /** 3+:0 (summary) has no commentary — the CM column is suppressed. */
  readonly showCmColumn: boolean;
  /** Full-word labels at 3+:0, abbreviated at 2+:1. */
  readonly tsLabel: string;
  readonly csLabel: string;
}

const SUMMARY_SPEC: ExpositoryTChartSpec = {
  stepNumber: 3,
  ratioLabel: "(3+:0)",
  badges: { ts: 1, cds: 2, cs: 3 },
  showRevisedTs: false,
  showCmColumn: false,
  tsLabel: "TOPIC SENTENCE:",
  csLabel: "CONCLUDING SENTENCE:",
};

const STANDARD_SPEC: ExpositoryTChartSpec = {
  stepNumber: 4,
  ratioLabel: "(2+:1)",
  badges: { ts: 1, cds: 2, cms: 3, revised_ts: 4, cs: 5 },
  showRevisedTs: true,
  showCmColumn: true,
  tsLabel: "TS:",
  csLabel: "CS:",
};

/**
 * Resolve the T-Chart layout spec for an Expository writing's ratio.
 * Expository assignments are only ever 2+:1 or 3+:0; one_to_two_plus
 * (literary) never reaches this component, but is treated as the
 * standard 2+:1 layout defensively rather than throwing.
 */
export function getExpositoryTChartSpec(
  ratio: ChunkRatio
): ExpositoryTChartSpec {
  return ratio === "three_plus_to_zero" ? SUMMARY_SPEC : STANDARD_SPEC;
}
