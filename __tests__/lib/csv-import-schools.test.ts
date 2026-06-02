/**
 * Unit coverage for the schools import descriptor's pure logic. classify/commit
 * are district-scoped and DB-backed (exercised via integration).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { schoolsDescriptor } from "@/lib/csv-import/descriptors/schools";

describe("schoolsDescriptor.parseRow", () => {
  it("accepts a valid row with a level", () => {
    const r = schoolsDescriptor.parseRow(
      { name: "Keller High", level: "High" },
      2
    );
    expect(r.error).toBeUndefined();
    expect(r.row).toEqual({ rowNumber: 2, name: "Keller High", level: "high" });
  });

  it("requires a name", () => {
    expect(schoolsDescriptor.parseRow({ name: " " }, 2).error).toMatch(/name/i);
  });

  it("allows a missing level (null)", () => {
    expect(schoolsDescriptor.parseRow({ name: "X" }, 2).row?.level).toBeNull();
  });

  it("rejects an unknown level", () => {
    expect(
      schoolsDescriptor.parseRow({ name: "X", level: "university" }, 2).error
    ).toMatch(/level/i);
  });

  it("normalizes level case", () => {
    expect(
      schoolsDescriptor.parseRow({ name: "X", level: "K12" }, 2).row?.level
    ).toBe("k12");
  });
});

describe("schoolsDescriptor.dedupeKey", () => {
  it("keys on name, case-insensitive", () => {
    expect(
      schoolsDescriptor.dedupeKey({ rowNumber: 2, name: "Keller High", level: null })
    ).toBe("name:keller high");
  });
});
