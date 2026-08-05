/**
 * Due dates when one assignment spans several class periods (migration 0050).
 *
 * The rule under test is the two-level fallback: a period's own `due_at` wins,
 * NULL inherits `assignments.due_at`. Storing NULL rather than copying the
 * default down is deliberate — it keeps classes that never overrode the date
 * following a later edit to it — so "NULL means inherit, and keeps inheriting"
 * is the property these tests pin.
 */

import { describe, it, expect } from "vitest";
import {
  distinctDueDates,
  earliestDueAt,
  effectiveDueAt,
  hasVaryingDueDates,
  type PeriodDueDate,
} from "@/lib/assignment-due-dates";

const MON = "2026-03-02T00:00:00+00:00";
const TUE = "2026-03-03T00:00:00+00:00";
const WED = "2026-03-04T00:00:00+00:00";

const P1 = "period-1";
const P6 = "period-6";
const P9 = "period-9";

/** Period 1 keeps the default, Period 6 overrides to Tuesday. */
const MIXED: PeriodDueDate[] = [
  { class_period_id: P1, due_at: null },
  { class_period_id: P6, due_at: TUE },
];

describe("effectiveDueAt", () => {
  it("uses the period's own date when it has one", () => {
    expect(effectiveDueAt(MON, MIXED, P6)).toBe(TUE);
  });

  it("inherits the assignment default when the period has none", () => {
    expect(effectiveDueAt(MON, MIXED, P1)).toBe(MON);
  });

  it("keeps inheriting after the default moves", () => {
    // The whole reason overrides are stored as NULL instead of a copy.
    expect(effectiveDueAt(WED, MIXED, P1)).toBe(WED);
    expect(effectiveDueAt(WED, MIXED, P6)).toBe(TUE);
  });

  it("falls back to the default for a period that isn't on the assignment", () => {
    expect(effectiveDueAt(MON, MIXED, P9)).toBe(MON);
  });

  it("falls back to the default when no period is given", () => {
    expect(effectiveDueAt(MON, MIXED, null)).toBe(MON);
  });

  it("returns null when neither level has a date", () => {
    expect(effectiveDueAt(null, [{ class_period_id: P1, due_at: null }], P1))
      .toBeNull();
  });
});

describe("distinctDueDates", () => {
  it("collapses periods that resolve to the same day", () => {
    const periods: PeriodDueDate[] = [
      { class_period_id: P1, due_at: null },
      { class_period_id: P6, due_at: MON },
    ];
    expect(distinctDueDates(MON, periods)).toEqual([MON]);
  });

  it("returns every distinct date, earliest first", () => {
    const periods: PeriodDueDate[] = [
      { class_period_id: P1, due_at: WED },
      { class_period_id: P6, due_at: MON },
      { class_period_id: P9, due_at: TUE },
    ];
    expect(distinctDueDates(null, periods)).toEqual([MON, TUE, WED]);
  });

  it("orders chronologically, not lexically", () => {
    // Same instant, different offsets — a string sort disagrees with a
    // chronological one, and the display order has to follow the clock.
    const utc = "2026-03-02T06:00:00+00:00";
    const cst = "2026-03-02T01:00:00-05:00"; // the same moment
    const later = "2026-03-02T09:00:00+00:00";
    const periods: PeriodDueDate[] = [
      { class_period_id: P1, due_at: later },
      { class_period_id: P6, due_at: cst },
    ];
    // `cst` sorts after `later` lexically ("2026-03-02T09" < "2026-03-02T01"
    // is false), so a naive sort would put them the wrong way round.
    expect(distinctDueDates(utc, periods)[0]).toBe(cst);
  });

  it("skips periods with no date at either level", () => {
    expect(distinctDueDates(null, [{ class_period_id: P1, due_at: null }]))
      .toEqual([]);
  });

  it("is empty for an assignment with no periods", () => {
    expect(distinctDueDates(MON, [])).toEqual([]);
  });
});

describe("hasVaryingDueDates", () => {
  it("is false when every class shares one deadline", () => {
    expect(
      hasVaryingDueDates(MON, [
        { class_period_id: P1, due_at: null },
        { class_period_id: P6, due_at: MON },
      ])
    ).toBe(false);
  });

  it("is true once one class overrides to a different day", () => {
    expect(hasVaryingDueDates(MON, MIXED)).toBe(true);
  });

  it("is false for a single class and for none at all", () => {
    expect(hasVaryingDueDates(MON, [{ class_period_id: P1, due_at: TUE }]))
      .toBe(false);
    expect(hasVaryingDueDates(MON, [])).toBe(false);
  });
});

describe("earliestDueAt", () => {
  it("leads with the first deadline any student is held to", () => {
    expect(earliestDueAt(WED, MIXED)).toBe(TUE);
  });

  it("falls back to the assignment default with no periods", () => {
    // A draft that hasn't been assigned to anything yet.
    expect(earliestDueAt(MON, [])).toBe(MON);
  });

  it("returns null when nothing has a date", () => {
    expect(earliestDueAt(null, [{ class_period_id: P1, due_at: null }]))
      .toBeNull();
  });
});
