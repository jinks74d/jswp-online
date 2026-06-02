/**
 * Unit coverage for the class-periods import descriptor's pure logic. The
 * dedupe key combines period_label + academic_year (the table's unique key).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { classPeriodsDescriptor } from "@/lib/csv-import/descriptors/class-periods";

describe("classPeriodsDescriptor.parseRow", () => {
  it("accepts a valid row", () => {
    expect(
      classPeriodsDescriptor.parseRow(
        { periodLabel: "2", academicYear: "2025-2026" },
        2
      ).row
    ).toEqual({ rowNumber: 2, periodLabel: "2", academicYear: "2025-2026" });
  });

  it("requires a period label", () => {
    expect(classPeriodsDescriptor.parseRow({ periodLabel: " " }, 2).error).toMatch(
      /period/i
    );
  });

  it("nulls an empty academic year", () => {
    expect(
      classPeriodsDescriptor.parseRow({ periodLabel: "1" }, 2).row?.academicYear
    ).toBeNull();
  });
});

describe("classPeriodsDescriptor.dedupeKey", () => {
  it("combines period label + academic year", () => {
    expect(
      classPeriodsDescriptor.dedupeKey({
        rowNumber: 2,
        periodLabel: "Block 3",
        academicYear: "2025-2026",
      })
    ).toBe("block 3|2025-2026");
  });

  it("treats periods with different years as distinct", () => {
    const a = classPeriodsDescriptor.dedupeKey({ rowNumber: 2, periodLabel: "1", academicYear: "2024-2025" });
    const b = classPeriodsDescriptor.dedupeKey({ rowNumber: 3, periodLabel: "1", academicYear: "2025-2026" });
    expect(a).not.toBe(b);
  });
});
