/**
 * Unit coverage for the classes import descriptor's pure logic.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { classesDescriptor } from "@/lib/csv-import/descriptors/classes";

describe("classesDescriptor.parseRow", () => {
  it("accepts a valid row", () => {
    expect(classesDescriptor.parseRow({ name: "English I Honors" }, 2).row).toEqual({
      rowNumber: 2,
      name: "English I Honors",
    });
  });

  it("requires a name", () => {
    expect(classesDescriptor.parseRow({ name: "" }, 2).error).toMatch(/name/i);
  });
});

describe("classesDescriptor.dedupeKey", () => {
  it("keys on name, case-insensitive", () => {
    expect(classesDescriptor.dedupeKey({ rowNumber: 2, name: "AP Lang" })).toBe(
      "name:ap lang"
    );
  });
});
