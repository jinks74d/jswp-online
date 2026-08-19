/**
 * Unit tests for the district analytics funnel maths (migration 0061).
 *
 * These derivations are the one place in the feature where a wrong answer
 * looks entirely plausible: both walk a step order the database does not have
 * and therefore cannot validate. A stall pointing at the wrong step, or a skip
 * rate double-counting, produces a dashboard that reads fine and misdirects
 * whoever acts on it.
 */

import { describe, it, expect } from "vitest";
import {
  deriveFunnel,
  rate,
  spineSteps,
} from "@/lib/district-funnel";
import { MODES } from "@/lib/jswp-modes";

/** Build a counts map from the ordered spine, for readability in tests. */
function counts(mode: Parameters<typeof spineSteps>[0], values: number[]) {
  const steps = spineSteps(mode);
  return new Map(steps.map((s, i) => [s.key, values[i] ?? 0]));
}

describe("rate", () => {
  it("divides", () => {
    expect(rate(1, 4)).toBe(0.25);
  });

  it("returns null rather than NaN on a zero denominator", () => {
    // The distinction the UI renders as "—". A district with no teachers and
    // a district where no teacher did anything are different facts.
    expect(rate(0, 0)).toBeNull();
  });

  it("returns null on a negative denominator", () => {
    expect(rate(1, -1)).toBeNull();
  });
});

describe("spineSteps", () => {
  it("excludes conditional steps", () => {
    // An essay-only step present for part of a cohort would read as a
    // catastrophic drop-off rather than a step most writings never had.
    for (const mode of Object.keys(MODES) as (keyof typeof MODES)[]) {
      for (const step of spineSteps(mode)) {
        expect(step.essayOnly).toBeFalsy();
        expect(step.requiresCounterargument).toBeFalsy();
        expect(step.requiresSourceText).toBeFalsy();
        expect(step.omitForRatio).toBeFalsy();
      }
    }
  });

  it("preserves the order declared in jswp-modes", () => {
    const spine = spineSteps("expository");
    const all = MODES.expository.steps.map((s) => s.key);
    const positions = spine.map((s) => all.indexOf(s.key));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("returns a non-empty spine for every mode", () => {
    for (const mode of Object.keys(MODES) as (keyof typeof MODES)[]) {
      expect(spineSteps(mode).length).toBeGreaterThan(0);
    }
  });
});

describe("deriveFunnel — stall", () => {
  it("names the step students fail to REACH, not the last one they finished", () => {
    const spine = spineSteps("expository");
    // 10 finish step 0, only 2 finish step 1 — the cliff is at step 1.
    const values = spine.map((_, i) => (i === 0 ? 10 : 2));
    const f = deriveFunnel("expository", counts("expository", values), 10);

    expect(f.stall).not.toBeNull();
    expect(f.stall!.stepKey).toBe(spine[1].key);
    expect(f.stall!.lost).toBe(8);
  });

  it("picks the largest drop when there are several", () => {
    const spine = spineSteps("expository");
    if (spine.length < 4) return; // guard: mode config could shrink
    const values = spine.map((_, i) => {
      if (i === 0) return 100;
      if (i === 1) return 90; // drop of 10
      if (i === 2) return 40; // drop of 50 — the winner
      return 38;
    });
    const f = deriveFunnel("expository", counts("expository", values), 100);

    expect(f.stall!.stepKey).toBe(spine[2].key);
    expect(f.stall!.lost).toBe(50);
  });

  it("is null when nobody drops off", () => {
    const spine = spineSteps("expository");
    const f = deriveFunnel(
      "expository",
      counts("expository", spine.map(() => 7)),
      7
    );
    expect(f.stall).toBeNull();
  });

  it("is null for an all-zero cohort", () => {
    const spine = spineSteps("literary");
    const f = deriveFunnel(
      "literary",
      counts("literary", spine.map(() => 0)),
      0
    );
    expect(f.stall).toBeNull();
  });
});

describe("deriveFunnel — skip rate", () => {
  it("is zero when every writing completes every step in order", () => {
    const spine = spineSteps("expository");
    const f = deriveFunnel(
      "expository",
      counts("expository", spine.map(() => 5)),
      5
    );
    expect(f.skipRate).toBe(0);
  });

  it("counts a writing that jumped a step in the middle", () => {
    const spine = spineSteps("expository");
    if (spine.length < 3) return;
    // One writing skipped step 1 but completed 0 and 2.
    const values = spine.map((_, i) => (i === 1 ? 0 : 1));
    const f = deriveFunnel("expository", counts("expository", values), 1);

    // Exactly one (writing × step) opportunity was jumped.
    expect(f.skipRate).toBeCloseTo(1 / spine.length, 10);
  });

  it("counts three consecutive skips as three, not one", () => {
    // The reason the derivation takes a forward MAXIMUM rather than comparing
    // against the immediate next step: neighbour-only comparison scores a run
    // of skipped steps as a single skip.
    const spine = spineSteps("expository");
    if (spine.length < 5) return;
    const last = spine.length - 1;
    const values = spine.map((_, i) => (i === 0 || i === last ? 1 : 0));
    const f = deriveFunnel("expository", counts("expository", values), 1);

    const jumped = spine.length - 2;
    expect(f.skipRate).toBeCloseTo(jumped / spine.length, 10);
  });

  it("does not count steps merely not reached yet", () => {
    // Monotonically decreasing counts mean students stopped, not skipped.
    // Only a LATER completion proves a step was passed over.
    const spine = spineSteps("expository");
    const values = spine.map((_, i) => Math.max(10 - i * 3, 0));
    const f = deriveFunnel("expository", counts("expository", values), 10);
    expect(f.skipRate).toBe(0);
  });

  it("is null for an empty cohort", () => {
    const f = deriveFunnel("narrative", new Map(), 0);
    expect(f.skipRate).toBeNull();
  });
});

describe("deriveFunnel — shape", () => {
  it("emits one point per spine step, in order, defaulting missing to zero", () => {
    const spine = spineSteps("argumentation");
    const f = deriveFunnel("argumentation", new Map(), 3);

    expect(f.points.map((p) => p.stepKey)).toEqual(spine.map((s) => s.key));
    expect(f.points.every((p) => p.reached === 0)).toBe(true);
    expect(f.cohortSize).toBe(3);
    expect(f.mode).toBe("argumentation");
  });

  it("ignores step keys the spine does not contain", () => {
    // A conditional step's rows arrive from the RPC but must not appear —
    // otherwise the funnel gains a point most of the cohort never had.
    const stray = new Map([["expository.does_not_exist", 99]]);
    const f = deriveFunnel("expository", stray, 1);
    expect(f.points.some((p) => p.stepKey.includes("does_not_exist"))).toBe(
      false
    );
  });
});
