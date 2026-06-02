/**
 * Unit coverage for the school-admins import descriptor's pure logic.
 * classify/commit are DB-backed + scoped (exercised via integration).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/scoped-users", () => ({ createScopedUser: vi.fn() }));

import { schoolAdminsDescriptor } from "@/lib/csv-import/descriptors/school-admins";

describe("schoolAdminsDescriptor.parseRow", () => {
  it("accepts a valid row and lowercases the email", () => {
    const r = schoolAdminsDescriptor.parseRow(
      { firstName: "Sam", lastName: "Lee", email: "Sam.Lee@District.ORG" },
      2
    );
    expect(r.error).toBeUndefined();
    expect(r.row).toEqual({
      rowNumber: 2,
      firstName: "Sam",
      lastName: "Lee",
      email: "sam.lee@district.org",
    });
  });

  it("requires first and last name", () => {
    expect(
      schoolAdminsDescriptor.parseRow({ firstName: "Sam", email: "a@b.org" }, 2)
        .error
    ).toMatch(/name/i);
  });

  it("rejects a malformed email", () => {
    expect(
      schoolAdminsDescriptor.parseRow(
        { firstName: "Sam", lastName: "Lee", email: "nope" },
        2
      ).error
    ).toMatch(/email/i);
  });
});

describe("schoolAdminsDescriptor.dedupeKey", () => {
  it("keys on email", () => {
    expect(
      schoolAdminsDescriptor.dedupeKey({
        rowNumber: 2,
        firstName: "Sam",
        lastName: "Lee",
        email: "sam@b.org",
      })
    ).toBe("email:sam@b.org");
  });
});
