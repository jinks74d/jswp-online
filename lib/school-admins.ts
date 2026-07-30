/**
 * Parsing + validation for the repeatable "school administrators" rows on the
 * create-school form.
 *
 * A school must be created with at least one school_admin — a school nobody can
 * administer is a dead end for the district admin who made it. The form submits
 * one set of repeated field names per row (admin_first_name, admin_last_name,
 * admin_email, admin_phone), which FormData.getAll() returns in DOM order.
 *
 * Pure: no DB, no auth. The action layer (lib/actions/schools.ts) owns
 * provisioning and rollback.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PHONE_DIGITS = 7;

export type SchoolAdminInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type SchoolAdminRowErrors = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export type SchoolAdminValidation = {
  /** Per-row errors, index-aligned with the input array (so the UI can map). */
  rowErrors: SchoolAdminRowErrors[];
  /** Whole-section error, e.g. nothing was filled in at all. */
  formError?: string;
  /** Rows that are non-blank and error-free, ready to provision. */
  valid: SchoolAdminInput[];
  ok: boolean;
};

/** A row the user left completely untouched — ignored rather than rejected. */
export function isBlankAdminRow(a: SchoolAdminInput): boolean {
  return !a.firstName && !a.lastName && !a.email && !a.phone;
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

/**
 * Read the repeated admin_* fields into rows. Field arrays are zipped by index;
 * the longest one sets the row count so a malformed submission can't silently
 * drop a row's email while keeping its name.
 */
export function parseSchoolAdmins(formData: FormData): SchoolAdminInput[] {
  const str = (v: FormDataEntryValue) => String(v).trim();
  const firstNames = formData.getAll("admin_first_name").map(str);
  const lastNames = formData.getAll("admin_last_name").map(str);
  const emails = formData.getAll("admin_email").map((v) => str(v).toLowerCase());
  const phones = formData.getAll("admin_phone").map(str);

  const count = Math.max(
    firstNames.length,
    lastNames.length,
    emails.length,
    phones.length
  );

  const rows: SchoolAdminInput[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      firstName: firstNames[i] ?? "",
      lastName: lastNames[i] ?? "",
      email: emails[i] ?? "",
      phone: phones[i] ?? "",
    });
  }
  return rows;
}

/**
 * Validate parsed rows. Blank rows are skipped (an untouched extra row is not
 * an error); at least one non-blank row is required. Duplicate emails within a
 * single submission are flagged on the later row — the DB would reject the
 * second insert anyway, and catching it here avoids a partial create + rollback.
 */
export function validateSchoolAdmins(
  rows: readonly SchoolAdminInput[]
): SchoolAdminValidation {
  const rowErrors: SchoolAdminRowErrors[] = rows.map(() => ({}));
  const valid: SchoolAdminInput[] = [];
  const seenEmail = new Set<string>();
  let filledRows = 0;

  rows.forEach((row, i) => {
    if (isBlankAdminRow(row)) return;
    filledRows++;

    const e: SchoolAdminRowErrors = {};
    if (!row.firstName) e.first_name = "First name is required.";
    if (!row.lastName) e.last_name = "Last name is required.";
    if (!row.email) e.email = "Email is required.";
    else if (!EMAIL_RE.test(row.email)) e.email = "Enter a valid email address.";
    else if (seenEmail.has(row.email)) e.email = "This email is used twice.";
    if (!row.phone) e.phone = "Phone number is required.";
    else if (digitCount(row.phone) < MIN_PHONE_DIGITS)
      e.phone = "Enter a valid phone number.";

    if (row.email) seenEmail.add(row.email);

    if (Object.keys(e).length > 0) rowErrors[i] = e;
    else valid.push(row);
  });

  const formError =
    filledRows === 0
      ? "Add at least one school administrator."
      : undefined;

  const hasRowErrors = rowErrors.some((e) => Object.keys(e).length > 0);

  return {
    rowErrors,
    formError,
    valid,
    ok: !formError && !hasRowErrors,
  };
}
