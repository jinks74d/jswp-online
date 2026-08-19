/**
 * Pure funnel arithmetic for district analytics (migration 0061).
 *
 * Split out of lib/queries/district-analytics.ts, which carries `server-only`
 * and so cannot be imported by the jsdom unit suite. This is the half worth
 * testing — the stall and skip derivations are the only place in the feature
 * where a plausible-looking wrong answer is possible, since both walk a step
 * order the database does not have and cannot check.
 *
 * No Supabase, no `server-only`, no React. Just counts in, shape out.
 */

import { MODES, type JswpMode, type StepConfig } from "@/lib/jswp-modes";

/* ─── Rates ───────────────────────────────────────────────────────────── */

/**
 * A rate in 0..1, or null when there is nothing to divide by.
 *
 * Null is deliberately not 0. "No teachers in this district" and "no teacher
 * did anything" are different facts, and a dashboard comparing four districts
 * makes the difference visible only if one of them renders as "—".
 */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/* ─── Types ───────────────────────────────────────────────────────────── */

export type StepFunnelPoint = {
  stepKey: string;
  label: string;
  /** Writings in the cohort that completed this step. */
  reached: number;
};

export type DistrictStepFunnel = {
  mode: JswpMode;
  cohortSize: number;
  points: readonly StepFunnelPoint[];
  /** The largest drop between consecutive steps — where students stop. */
  stall: { stepKey: string; label: string; lost: number } | null;
  /**
   * Share of step-opportunities advanced past without completion, 0..1.
   * Null when the cohort is empty.
   */
  skipRate: number | null;
};

/* ─── Derivation ──────────────────────────────────────────────────────── */

/**
 * The steps every writing in a mode sees, in order.
 *
 * Conditional steps (essayOnly, requiresCounterargument, requiresSourceText,
 * omitForRatio) are excluded. They are filtered out per-writing by getSteps(),
 * so a cohort mixing essays and single paragraphs leaves an essay-only step
 * with rows from only part of the cohort — which a funnel would misread as a
 * catastrophic drop-off rather than a step most writings never had.
 *
 * Reading MODES directly rather than hardcoding: CLAUDE.md §7 makes
 * lib/jswp-modes.ts the only step list, and reordering a mode there must
 * reorder this funnel with no edit here.
 */
export function spineSteps(mode: JswpMode): readonly StepConfig[] {
  return MODES[mode].steps.filter(
    (s) =>
      !s.essayOnly &&
      !s.requiresCounterargument &&
      !s.requiresSourceText &&
      !s.omitForRatio
  );
}

/**
 * Derive the stall step and skip rate from raw per-step completion counts.
 *
 * Both need step ORDER, which the database does not have — step_key is an
 * opaque string there (migration 0061 §7). This is why the RPC returns counts
 * unordered and the derivation lives here.
 *
 * Skip is measurable because skip-step-button.tsx advances current_step
 * WITHOUT writing step_progress. So a writing holding a row at a LATER step
 * but none here did not merely fail to arrive — it went past. Taking the
 * forward maximum rather than the immediate next step matters: a student who
 * skips three steps in a row must count as three skips, and comparing only
 * against the neighbour would score that as one.
 */
export function deriveFunnel(
  mode: JswpMode,
  counts: ReadonlyMap<string, number>,
  cohortSize: number
): DistrictStepFunnel {
  const steps = spineSteps(mode);
  const points: StepFunnelPoint[] = steps.map((s) => ({
    stepKey: s.key,
    label: s.label,
    reached: counts.get(s.key) ?? 0,
  }));

  let stall: DistrictStepFunnel["stall"] = null;
  for (let i = 0; i < points.length - 1; i++) {
    const lost = points[i].reached - points[i + 1].reached;
    if (lost > 0 && (stall === null || lost > stall.lost)) {
      // Named for the step students fail to REACH, which is the one to go
      // look at — not the step they last completed.
      stall = {
        stepKey: points[i + 1].stepKey,
        label: points[i + 1].label,
        lost,
      };
    }
  }

  let skipped = 0;
  for (let i = 0; i < points.length; i++) {
    let furtherMax = 0;
    for (let j = i + 1; j < points.length; j++) {
      if (points[j].reached > furtherMax) furtherMax = points[j].reached;
    }
    const past = furtherMax - points[i].reached;
    if (past > 0) skipped += past;
  }

  return {
    mode,
    cohortSize,
    points,
    stall,
    // Denominator is every (writing × step) pair in the cohort, so the rate
    // reads as "what share of all the work was jumped over" and stays
    // comparable between modes with different step counts.
    skipRate: rate(skipped, cohortSize * points.length),
  };
}
