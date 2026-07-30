/**
 * Unit coverage for the subjects import descriptor's pure logic.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { subjectsDescriptor } from "@/lib/csv-import/descriptors/subjects";

describe("subjectsDescriptor.parseRow", () => {
  it("accepts a valid row", () => {
    const r = subjectsDescriptor.parseRow(
      { name: "English", description: "Language arts" },
      2
    );
    expect(r.row).toEqual({
      rowNumber: 2,
      name: "English",
      description: "Language arts",
    });
  });

  it("requires a name", () => {
    expect(subjectsDescriptor.parseRow({ name: " " }, 2).error).toMatch(/name/i);
  });

  it("nulls an empty description", () => {
    expect(subjectsDescriptor.parseRow({ name: "Math" }, 2).row?.description).toBeNull();
  });
});

describe("subjectsDescriptor.dedupeKey", () => {
  it("keys on name, case-insensitive", () => {
    expect(
      subjectsDescriptor.dedupeKey({ rowNumber: 2, name: "English", description: null })
    ).toBe("name:english");
  });
});
