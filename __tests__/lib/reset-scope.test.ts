/**
 * Unit tests for canReset — who may send a password reset to whom.
 *
 * This is the security decision in the admin-reset feature. The send runs on
 * the admin client and bypasses RLS, so nothing downstream re-checks it: if
 * this function says yes, a password-set link for that account goes to that
 * account's address, and whoever asked for it controls the reset.
 *
 * The null-matching cases below are the ones worth reading. `null === null`
 * is the classic way a tenant check silently stops containing anything.
 */

import { describe, it, expect } from "vitest";
import { canReset, type ResetParty } from "@/lib/reset-scope";

const D1 = "district-1";
const D2 = "district-2";
const S1 = "school-1";
const S2 = "school-2";

function party(
  id: string,
  role: ResetParty["role"],
  district_id: string | null = D1,
  school_id: string | null = null
): ResetParty {
  return { id, role, district_id, school_id };
}

const superAdmin = party("super", "super_admin", null, null);
const districtAdmin1 = party("da1", "district_admin", D1, null);
const districtAdmin2 = party("da2", "district_admin", D2, null);
const schoolAdmin1 = party("sa1", "school_admin", D1, S1);
const schoolAdmin2 = party("sa2", "school_admin", D1, S2);
const teacher1 = party("t1", "teacher", D1, S1);
const teacherOtherSchool = party("t2", "teacher", D1, S2);
const teacherOtherDistrict = party("t3", "teacher", D2, S2);
const student1 = party("st1", "student", D1, S1);
const analyst = party("an1", "district_analyst", D1, null);

describe("canReset — super admin", () => {
  it("can reset anyone in any district", () => {
    expect(canReset(superAdmin, teacher1)).toBe(true);
    expect(canReset(superAdmin, teacherOtherDistrict)).toBe(true);
    expect(canReset(superAdmin, districtAdmin2)).toBe(true);
    expect(canReset(superAdmin, student1)).toBe(true);
  });

  it("can reset another super admin", () => {
    expect(canReset(superAdmin, party("super2", "super_admin", null, null))).toBe(
      true
    );
  });
});

describe("canReset — district admin", () => {
  it("can reset users in their own district", () => {
    expect(canReset(districtAdmin1, teacher1)).toBe(true);
    expect(canReset(districtAdmin1, student1)).toBe(true);
    expect(canReset(districtAdmin1, schoolAdmin1)).toBe(true);
  });

  it("cannot reach another district", () => {
    expect(canReset(districtAdmin1, teacherOtherDistrict)).toBe(false);
    expect(canReset(districtAdmin1, districtAdmin2)).toBe(false);
  });

  it("cannot reset a super admin", () => {
    // The escalation that matters: a password-set link for a platform-wide
    // account, mailed on demand by a single tenant's admin.
    expect(canReset(districtAdmin1, superAdmin)).toBe(false);
  });

  it("does not match a districtless target through null === null", () => {
    const districtlessAdmin = party("da0", "district_admin", null, null);
    const districtlessTarget = party("x", "teacher", null, null);
    expect(canReset(districtlessAdmin, districtlessTarget)).toBe(false);
  });
});

describe("canReset — school admin", () => {
  it("can reset users at their own school", () => {
    expect(canReset(schoolAdmin1, teacher1)).toBe(true);
    expect(canReset(schoolAdmin1, student1)).toBe(true);
  });

  it("cannot reach another school, even in the same district", () => {
    expect(canReset(schoolAdmin1, teacherOtherSchool)).toBe(false);
    expect(canReset(schoolAdmin1, schoolAdmin2)).toBe(false);
  });

  it("cannot reset the district admin above them", () => {
    // district_admin legitimately carries school_id = null, so a loose
    // comparison here would let any school admin reset every admin above them.
    expect(canReset(schoolAdmin1, districtAdmin1)).toBe(false);
  });

  it("cannot reset a district analyst, who is also schoolless", () => {
    expect(canReset(schoolAdmin1, analyst)).toBe(false);
  });

  it("cannot reset a super admin", () => {
    expect(canReset(schoolAdmin1, superAdmin)).toBe(false);
  });
});

describe("canReset — roles with no reset power", () => {
  it("refuses teachers, including for their own students", () => {
    // Deliberate, not an oversight — see the note in lib/reset-scope.ts.
    expect(canReset(teacher1, student1)).toBe(false);
  });

  it("refuses students", () => {
    expect(canReset(student1, teacher1)).toBe(false);
  });

  it("refuses district analysts", () => {
    // The analyst role is read-only by construction (migration 0061).
    expect(canReset(analyst, teacher1)).toBe(false);
    expect(canReset(analyst, student1)).toBe(false);
  });
});

describe("canReset — self", () => {
  it("refuses every role resetting themselves", () => {
    for (const p of [superAdmin, districtAdmin1, schoolAdmin1, teacher1]) {
      expect(canReset(p, p)).toBe(false);
    }
  });

  it("refuses even when the two objects merely share an id", () => {
    const copy = { ...districtAdmin1, school_id: S1 };
    expect(canReset(districtAdmin1, copy)).toBe(false);
  });
});
