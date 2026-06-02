/**
 * Unit coverage for the class-students import descriptor's pure logic.
 * classify/commit are DB-backed + scoped (exercised via integration).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/scoped-users", () => ({ createScopedUser: vi.fn() }));

import { classStudentsDescriptor } from "@/lib/csv-import/descriptors/class-students";

describe("classStudentsDescriptor.parseRow", () => {
  it("accepts a full row and lowercases the email", () => {
    const r = classStudentsDescriptor.parseRow(
      {
        firstName: "Alex",
        lastName: "Kim",
        email: "Alex.Kim@S.org",
        gradeLevel: "9",
        studentIdExternal: "SIS-42",
      },
      2
    );
    expect(r.row).toEqual({
      rowNumber: 2,
      firstName: "Alex",
      lastName: "Kim",
      email: "alex.kim@s.org",
      gradeLevel: "9",
      studentIdExternal: "SIS-42",
    });
  });

  it("requires names + a valid email", () => {
    expect(
      classStudentsDescriptor.parseRow({ firstName: "Alex", email: "Kim" }, 2)
        .error
    ).toBeTruthy();
  });

  it("nulls empty optional fields", () => {
    const row = classStudentsDescriptor.parseRow(
      { firstName: "A", lastName: "B", email: "a@b.org" },
      2
    ).row;
    expect(row?.gradeLevel).toBeNull();
    expect(row?.studentIdExternal).toBeNull();
  });
});

describe("classStudentsDescriptor.dedupeKey", () => {
  it("keys on email", () => {
    expect(
      classStudentsDescriptor.dedupeKey({
        rowNumber: 2,
        firstName: "A",
        lastName: "B",
        email: "a@b.org",
        gradeLevel: null,
        studentIdExternal: null,
      })
    ).toBe("email:a@b.org");
  });
});
