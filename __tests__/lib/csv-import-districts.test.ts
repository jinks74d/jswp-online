/**
 * Unit coverage for the districts import descriptor's pure logic (parseRow +
 * dedupeKey). classify/commit hit the DB and are exercised via integration.
 */

import { describe, it, expect, vi } from "vitest";

// districts.ts is server-only and imports the supabase client factories at
// module load; stub them so the import resolves in the test runner. parseRow
// and dedupeKey never touch them.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { districtsDescriptor } from "@/lib/csv-import/descriptors/districts";

describe("districtsDescriptor.parseRow", () => {
  it("accepts a valid row", () => {
    const r = districtsDescriptor.parseRow(
      { name: "LACOE", subdomain: "lacoe", contactEmail: "a@b.org" },
      2
    );
    expect(r.error).toBeUndefined();
    expect(r.row).toEqual({
      rowNumber: 2,
      name: "LACOE",
      subdomain: "lacoe",
      contactEmail: "a@b.org",
    });
  });

  it("requires a name", () => {
    expect(districtsDescriptor.parseRow({ name: "  " }, 2).error).toMatch(/name/i);
  });

  it("rejects a malformed subdomain", () => {
    expect(
      districtsDescriptor.parseRow({ name: "X", subdomain: "Bad_Sub!" }, 2).error
    ).toMatch(/subdomain/i);
  });

  it("lowercases the subdomain", () => {
    expect(
      districtsDescriptor.parseRow({ name: "X", subdomain: "LACOE" }, 2).row
        ?.subdomain
    ).toBe("lacoe");
  });

  it("rejects a malformed contact email", () => {
    expect(
      districtsDescriptor.parseRow({ name: "X", contactEmail: "nope" }, 2).error
    ).toMatch(/email/i);
  });

  it("nulls empty optional fields", () => {
    const row = districtsDescriptor.parseRow({ name: "X" }, 2).row;
    expect(row?.subdomain).toBeNull();
    expect(row?.contactEmail).toBeNull();
  });
});

describe("districtsDescriptor.dedupeKey", () => {
  it("prefers subdomain", () => {
    expect(
      districtsDescriptor.dedupeKey({
        rowNumber: 2,
        name: "X",
        subdomain: "lacoe",
        contactEmail: null,
      })
    ).toBe("sub:lacoe");
  });

  it("falls back to name (case-insensitive)", () => {
    expect(
      districtsDescriptor.dedupeKey({
        rowNumber: 2,
        name: "Big District",
        subdomain: null,
        contactEmail: null,
      })
    ).toBe("name:big district");
  });
});
