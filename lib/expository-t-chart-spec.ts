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
 *
 * The `badges` map is the teaching payload: the printed sheet stamps a
 * small number on each region because the student does NOT fill the sheet
 * top-to-bottom. The Revised TS sits second from the top but is written
 * fourth, after the CD and CM work it stitches from.
 */

import { isSummaryRatio, ratioClass, type ChunkRatio } from "@/lib/jswp-modes";

/**
 * T-Chart regions, declared in the order the student works them.
 *
 * `cm_sentence` is the printed sheet's full-width COMMENTARY SENTENCE line
 * (2024 Expository Guide p.79) — the paragraph's single CM sentence,
 * Pick-n-Stitched from unused commentary words. It is distinct from `cms`
 * (the per-CD green clouds the student stitches *from*).
 */
export type TChartRegion =
  | "ts"
  | "cds"
  | "cms"
  | "revised_ts"
  | "cm_sentence"
  | "cs";

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
  /** Same reason: no CM clouds at 3+:0 means no CM sentence to stitch. */
  readonly showCmSentence: boolean;
  /** Full-word labels at 3+:0; the 2+:1 TS is the "throwaway" first draft. */
  readonly tsLabel: string;
  /**
   * Instruction under the TS label. Null at 3+:0: with no Revised TS row
   * there is nothing to revise into, so calling that one a first draft
   * would promise a second the summary layout never offers.
   */
  readonly tsHint: string | null;
  readonly csLabel: string;
}

const SUMMARY_SPEC: ExpositoryTChartSpec = {
  stepNumber: 3,
  ratioLabel: "(3+:0)",
  badges: { ts: 1, cds: 2, cs: 3 },
  showRevisedTs: false,
  showCmColumn: false,
  showCmSentence: false,
  tsLabel: "Topic Sentence:",
  tsHint: null,
  csLabel: "Concluding Sentence:",
};

const STANDARD_SPEC: ExpositoryTChartSpec = {
  stepNumber: 4,
  ratioLabel: "(2+:1)",
  badges: { ts: 1, cds: 2, cms: 3, revised_ts: 4, cm_sentence: 5, cs: 6 },
  showRevisedTs: true,
  showCmColumn: true,
  showCmSentence: true,
  tsLabel: "“Throwaway” Topic Sentence (TS):",
  tsHint: "Write a first draft topic sentence for this body paragraph.",
  csLabel: "Concluding Sentence (CS):",
};

// 1:1 shares the standard CD + CM layout (revised-TS row, CM column) — it
// differs from 2+:1 only in proportion, and thus only in the ratio label.
const ONE_TO_ONE_SPEC: ExpositoryTChartSpec = {
  ...STANDARD_SPEC,
  ratioLabel: "(1:1)",
};

/**
 * Resolve the T-Chart layout spec for an Expository writing's ratio.
 * Expository assignments are 2+:1, 1:1, or 3+:0; the 1:2+ (literary)
 * proportion never reaches this component, but is treated as the
 * standard 2+:1 layout defensively rather than throwing.
 */
export function getExpositoryTChartSpec(
  ratio: ChunkRatio
): ExpositoryTChartSpec {
  if (isSummaryRatio(ratio)) return SUMMARY_SPEC;
  if (ratioClass(ratio) === "one_to_one") return ONE_TO_ONE_SPEC;
  return STANDARD_SPEC;
}
