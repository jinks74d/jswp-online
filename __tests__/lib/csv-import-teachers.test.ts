/**
 * Teachers import descriptor — shares the school-user factory with school
 * admins; this pins the role-specific wiring + the shared parse logic.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/scoped-users", () => ({ createScopedUser: vi.fn() }));

import { teachersDescriptor } from "@/lib/csv-import/descriptors/teachers";

describe("teachersDescriptor", () => {
  it("is the teachers entity, creatable by super/district admins", () => {
    expect(teachersDescriptor.entity).toBe("teachers");
    expect(teachersDescriptor.roles).toEqual(["super_admin", "district_admin"]);
  });

  it("validates + normalizes a row via the shared parser", () => {
    const r = teachersDescriptor.parseRow(
      { firstName: "Dana", lastName: "Ng", email: "Dana.NG@s.org" },
      2
    );
    expect(r.row).toEqual({
      rowNumber: 2,
      firstName: "Dana",
      lastName: "Ng",
      email: "dana.ng@s.org",
    });
  });

  it("rejects a malformed email", () => {
    expect(
      teachersDescriptor.parseRow({ firstName: "A", lastName: "B", email: "x" }, 2)
        .error
    ).toMatch(/email/i);
  });
});
