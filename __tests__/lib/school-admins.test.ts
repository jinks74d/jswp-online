import { describe, it, expect } from "vitest";
import {
  parseSchoolAdmins,
  validateSchoolAdmins,
  isBlankAdminRow,
  type SchoolAdminInput,
} from "@/lib/school-admins";

/** Build a FormData with one repeated field set per row. */
function formDataFor(
  rows: readonly Partial<Record<
    "first" | "last" | "email" | "phone",
    string
  >>[]
): FormData {
  const fd = new FormData();
  for (const r of rows) {
    fd.append("admin_first_name", r.first ?? "");
    fd.append("admin_last_name", r.last ?? "");
    fd.append("admin_email", r.email ?? "");
    fd.append("admin_phone", r.phone ?? "");
  }
  return fd;
}

const GOOD = {
  first: "Dana",
  last: "Reyes",
  email: "dana@keller.org",
  phone: "555-201-8890",
};

describe("parseSchoolAdmins", () => {
  it("zips repeated fields into rows, trimming and lowercasing email", () => {
    const rows = parseSchoolAdmins(
      formDataFor([
        { first: " Dana ", last: "Reyes", email: " Dana@Keller.org ", phone: "5552018890" },
        { first: "Sam", last: "Ito", email: "sam@keller.org", phone: "5552018891" },
      ])
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      firstName: "Dana",
      lastName: "Reyes",
      email: "dana@keller.org",
      phone: "5552018890",
    });
    expect(rows[1].lastName).toBe("Ito");
  });

  it("returns no rows for an empty submission", () => {
    expect(parseSchoolAdmins(new FormData())).toEqual([]);
  });

  it("pads short field arrays instead of misaligning rows", () => {
    // Two names but only one email — row 1 must keep its name and get "" email,
    // not silently inherit row 0's.
    const fd = new FormData();
    fd.append("admin_first_name", "Dana");
    fd.append("admin_first_name", "Sam");
    fd.append("admin_email", "dana@keller.org");
    const rows = parseSchoolAdmins(fd);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      firstName: "Sam",
      lastName: "",
      email: "",
      phone: "",
    });
  });
});

describe("isBlankAdminRow", () => {
  it("is true only when every field is empty", () => {
    const blank: SchoolAdminInput = {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    };
    expect(isBlankAdminRow(blank)).toBe(true);
    expect(isBlankAdminRow({ ...blank, phone: "555" })).toBe(false);
  });
});

describe("validateSchoolAdmins", () => {
  it("accepts a single complete row", () => {
    const v = validateSchoolAdmins(parseSchoolAdmins(formDataFor([GOOD])));
    expect(v.ok).toBe(true);
    expect(v.formError).toBeUndefined();
    expect(v.valid).toHaveLength(1);
  });

  it("requires at least one administrator", () => {
    const v = validateSchoolAdmins(parseSchoolAdmins(formDataFor([{}])));
    expect(v.ok).toBe(false);
    expect(v.formError).toBe("Add at least one school administrator.");
  });

  it("treats a submission with no rows at all as missing an administrator", () => {
    const v = validateSchoolAdmins([]);
    expect(v.ok).toBe(false);
    expect(v.formError).toBe("Add at least one school administrator.");
  });

  it("ignores a trailing blank row when another row is filled", () => {
    const v = validateSchoolAdmins(parseSchoolAdmins(formDataFor([GOOD, {}])));
    expect(v.ok).toBe(true);
    expect(v.valid).toHaveLength(1);
    expect(v.rowErrors[1]).toEqual({});
  });

  it("flags every missing field on a partially-filled row", () => {
    const v = validateSchoolAdmins(
      parseSchoolAdmins(formDataFor([{ first: "Dana" }]))
    );
    expect(v.ok).toBe(false);
    expect(v.rowErrors[0]).toEqual({
      last_name: "Last name is required.",
      email: "Email is required.",
      phone: "Phone number is required.",
    });
  });

  it("rejects a malformed email and a too-short phone", () => {
    const v = validateSchoolAdmins(
      parseSchoolAdmins(
        formDataFor([{ ...GOOD, email: "dana-at-keller", phone: "12" }])
      )
    );
    expect(v.rowErrors[0].email).toBe("Enter a valid email address.");
    expect(v.rowErrors[0].phone).toBe("Enter a valid phone number.");
  });

  it("accepts a formatted phone with punctuation", () => {
    const v = validateSchoolAdmins(
      parseSchoolAdmins(formDataFor([{ ...GOOD, phone: "(555) 201-8890" }]))
    );
    expect(v.ok).toBe(true);
  });

  it("flags a duplicate email on the later row only", () => {
    const v = validateSchoolAdmins(
      parseSchoolAdmins(
        formDataFor([GOOD, { ...GOOD, first: "Sam", last: "Ito" }])
      )
    );
    expect(v.ok).toBe(false);
    expect(v.rowErrors[0]).toEqual({});
    expect(v.rowErrors[1].email).toBe("This email is used twice.");
  });

  it("keeps rowErrors index-aligned with the submitted rows", () => {
    // Blank middle row must still occupy index 1 so the UI maps errors to the
    // right rendered row.
    const v = validateSchoolAdmins(
      parseSchoolAdmins(formDataFor([GOOD, {}, { first: "Sam" }]))
    );
    expect(v.rowErrors).toHaveLength(3);
    expect(v.rowErrors[1]).toEqual({});
    expect(v.rowErrors[2].email).toBe("Email is required.");
  });

  it("returns only error-free rows in valid", () => {
    const v = validateSchoolAdmins(
      parseSchoolAdmins(formDataFor([GOOD, { first: "Sam" }]))
    );
    expect(v.ok).toBe(false);
    expect(v.valid).toHaveLength(1);
    expect(v.valid[0].email).toBe(GOOD.email);
  });
});
