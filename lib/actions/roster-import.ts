/**
 * Server actions for the roster import flow.
 *
 *   parseRosterFile(formData) — reads the uploaded file, normalizes headers,
 *     validates structure. Returns { rows, errors, fileName } so the UI can
 *     render a preview before any DB writes happen.
 *
 *   importRoster(rows, classPeriodId, fileName) — for each row: idempotent
 *     UPDATE if email already exists in the target district, otherwise
 *     CREATE both auth.users (admin API) and user_profiles. Then UPSERT a
 *     class_student_enrollments row. Writes one audit_log row at the end.
 *
 * Reads scope-checks (does the admin have access to this class period?)
 * via the RLS-scoped server client, then writes via the admin client.
 */

"use server";

import "server-only";

import * as crypto from "crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VALUE_LENGTH = 1000;
const PASSWORD_LENGTH = 12;

/* ─── Types ──────────────────────────────────────────────────────────── */

export type RosterRow = {
  rowNumber: number; // spreadsheet row number (header is 1, first data row is 2)
  email: string;
  firstName: string;
  lastName: string;
  gradeLevel: string | null;
  studentIdExternal: string | null;
};

export type ParseError = {
  rowNumber: number | null;
  message: string;
};

export type ParseResult = {
  rows: RosterRow[];
  errors: ParseError[];
  fileName: string;
};

export type ImportRowError = {
  rowNumber: number;
  email: string;
  message: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  errors: ImportRowError[];
  credentials: { email: string; password: string }[];
  classPeriodId: string;
  districtId: string;
  schoolId: string;
};

/* ─── Header mapping ─────────────────────────────────────────────────── */

const HEADER_ALIASES: Record<string, keyof Omit<RosterRow, "rowNumber">> = {
  email: "email",
  student_email: "email",
  first_name: "firstName",
  firstname: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  grade_level: "gradeLevel",
  grade: "gradeLevel",
  student_id_external: "studentIdExternal",
  external_id: "studentIdExternal",
  sis_id: "studentIdExternal",
};

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function sanitizeCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Strip CSV-injection prefixes (Excel/Numbers will execute these as formulas)
  s = s.replace(/^[@=+\-]/, "");
  return s.trim().substring(0, MAX_VALUE_LENGTH);
}

function generatePassword(): string {
  // 12 chars from [A-Za-z0-9]. Using crypto.randomBytes via rejection sampling
  // could give cleaner uniform distribution, but a simple modulo over a large
  // 62-char alphabet has negligible bias for our purposes (admin-distributed
  // bootstrap passwords, not long-term secrets).
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(PASSWORD_LENGTH);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

/* ─── parseRosterFile ────────────────────────────────────────────────── */

export async function parseRosterFile(
  formData: FormData
): Promise<ParseResult> {
  await requireRole(["super_admin", "district_admin", "school_admin"]);

  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    return {
      rows: [],
      errors: [{ rowNumber: null, message: "No file provided." }],
      fileName: "",
    };
  }

  const fileName = file.name;

  if (file.size > MAX_FILE_SIZE) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: null,
          message: `File exceeds the 10MB limit (${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB).`,
        },
      ],
      fileName,
    };
  }

  const ext = fileName.toLowerCase().match(/\.(csv|xlsx|xls)$/)?.[1];
  if (!ext) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: null,
          message: "File must be .csv, .xlsx, or .xls.",
        },
      ],
      fileName,
    };
  }

  // Parse to a uniform `Record<string, string>[]` shape, preserving the
  // original header keys so we can normalize them in one place.
  let rawRows: Record<string, unknown>[];
  try {
    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: normalizeHeader,
      });
      if (parsed.errors.length > 0) {
        return {
          rows: [],
          errors: parsed.errors.slice(0, 5).map((e) => ({
            rowNumber: e.row !== undefined ? e.row + 2 : null,
            message: `CSV parse error: ${e.message}`,
          })),
          fileName,
        };
      }
      rawRows = parsed.data;
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          rows: [],
          errors: [{ rowNumber: null, message: "Workbook is empty." }],
          fileName,
        };
      }
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        raw: false,
        defval: "",
      });
      // Normalize headers on the keys after sheet_to_json
      rawRows = json.map((row) => {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(row)) {
          out[normalizeHeader(k)] = row[k];
        }
        return out;
      });
    }
  } catch (e) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: null,
          message: `Failed to parse file: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        },
      ],
      fileName,
    };
  }

  if (rawRows.length === 0) {
    return {
      rows: [],
      errors: [
        { rowNumber: null, message: "No data rows found after the header." },
      ],
      fileName,
    };
  }

  // Map normalized headers → canonical keys
  const rows: RosterRow[] = [];
  const errors: ParseError[] = [];
  const seenEmails = new Map<string, number[]>();

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexing
    const mapped: Partial<Record<keyof RosterRow, string>> = {};

    for (const key of Object.keys(raw)) {
      const canonical = HEADER_ALIASES[key];
      if (canonical) {
        mapped[canonical] = sanitizeCell(raw[key]);
      }
    }

    const email = (mapped.email ?? "").toLowerCase();
    const firstName = mapped.firstName ?? "";
    const lastName = mapped.lastName ?? "";
    const gradeLevel = mapped.gradeLevel ? mapped.gradeLevel : null;
    const studentIdExternal = mapped.studentIdExternal
      ? mapped.studentIdExternal
      : null;

    // Validate required fields
    const missing: string[] = [];
    if (!email) missing.push("email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        rowNumber,
        message: `Row ${rowNumber}: invalid email "${email}".`,
      });
      continue;
    }
    if (!firstName) missing.push("first_name");
    if (!lastName) missing.push("last_name");
    if (missing.length > 0) {
      errors.push({
        rowNumber,
        message: `Row ${rowNumber}: missing required field${
          missing.length > 1 ? "s" : ""
        }: ${missing.join(", ")}.`,
      });
      continue;
    }

    // Within-file duplicate detection
    const dupRows = seenEmails.get(email);
    if (dupRows) {
      dupRows.push(rowNumber);
      errors.push({
        rowNumber,
        message: `Row ${rowNumber}: duplicate email "${email}" (also in row ${dupRows[0]}).`,
      });
      continue;
    }
    seenEmails.set(email, [rowNumber]);

    rows.push({
      rowNumber,
      email,
      firstName,
      lastName,
      gradeLevel,
      studentIdExternal,
    });
  }

  return { rows, errors, fileName };
}

/* ─── importRoster ───────────────────────────────────────────────────── */

export async function importRoster(
  rosterRows: RosterRow[],
  classPeriodId: string,
  fileName: string
): Promise<ImportResult> {
  const profile = await requireRole([
    "super_admin",
    "district_admin",
    "school_admin",
  ]);

  // Verify the admin can see this class period — RLS-scoped read.
  const supabase = await createServerClient();
  const lookup = await supabase
    .from("class_periods")
    .select("id, school_id, schools:school_id(district_id)")
    .eq("id", classPeriodId)
    .maybeSingle();

  type ClassPeriodLookup = {
    id: string;
    school_id: string;
    schools: { district_id: string } | null;
  };
  const classPeriod = lookup.data as unknown as ClassPeriodLookup | null;

  if (lookup.error || !classPeriod) {
    throw new Error(
      "Class period not found, or you do not have access to it."
    );
  }

  const schoolId = classPeriod.school_id;
  const districtId = classPeriod.schools?.district_id;

  if (!districtId) {
    throw new Error("Could not resolve district for the chosen class period.");
  }

  const result: ImportResult = {
    created: 0,
    updated: 0,
    errors: [],
    credentials: [],
    classPeriodId,
    districtId,
    schoolId,
  };

  const admin = createAdminClient();

  for (const row of rosterRows) {
    try {
      // Look up an existing user_profile by email (email is UNIQUE globally
      // per the schema, so this is the canonical existence check).
      const { data: existing, error: lookupErr } = await admin
        .from("user_profiles")
        .select("id, district_id, role")
        .eq("email", row.email)
        .maybeSingle();

      if (lookupErr) throw lookupErr;

      let studentId: string;

      if (existing) {
        if (existing.district_id !== districtId) {
          throw new Error(
            "Email already exists in a different district — cannot reassign."
          );
        }
        if (existing.role !== "student") {
          throw new Error(
            `Email exists with role "${existing.role}" — cannot re-import as student.`
          );
        }

        // Idempotent UPDATE — refresh PII fields, do NOT rotate password
        // and do NOT touch auth.users.
        const { error: updErr } = await admin
          .from("user_profiles")
          .update({
            first_name: row.firstName,
            last_name: row.lastName,
            grade_level: row.gradeLevel,
            student_id_external: row.studentIdExternal,
            school_id: schoolId,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;

        studentId = existing.id;
        result.updated++;
      } else {
        // CREATE — auth.users first, then user_profiles. If the profile
        // insert fails, delete the orphan auth user so we don't leave
        // unreachable accounts behind.
        const password = generatePassword();
        const { data: authData, error: authErr } =
          await admin.auth.admin.createUser({
            email: row.email,
            password,
            email_confirm: true,
          });
        if (authErr || !authData.user) {
          throw new Error(
            authErr?.message ?? "Failed to create auth user."
          );
        }

        const newUserId = authData.user.id;

        const { error: profErr } = await admin.from("user_profiles").insert({
          id: newUserId,
          district_id: districtId,
          school_id: schoolId,
          role: "student",
          email: row.email,
          first_name: row.firstName,
          last_name: row.lastName,
          grade_level: row.gradeLevel,
          student_id_external: row.studentIdExternal,
        });

        if (profErr) {
          // Best-effort cleanup of orphan auth user
          await admin.auth.admin.deleteUser(newUserId).catch(() => {
            /* swallow — surfaced via the original profErr below */
          });
          throw profErr;
        }

        studentId = newUserId;
        result.created++;
        result.credentials.push({ email: row.email, password });
      }

      // UPSERT enrollment — primary key is (class_period_id, student_id).
      const { error: enrollErr } = await admin
        .from("class_student_enrollments")
        .upsert(
          { class_period_id: classPeriodId, student_id: studentId },
          { onConflict: "class_period_id,student_id" }
        );
      if (enrollErr) throw enrollErr;
    } catch (e) {
      result.errors.push({
        rowNumber: row.rowNumber,
        email: row.email,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Audit log — service role is the only permitted writer.
  await admin.from("audit_log").insert({
    actor_id: profile.id,
    action: "roster.import.students",
    target_scope: { class_period_id: classPeriodId },
    metadata: {
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      file_name: fileName,
      district_id: districtId,
      school_id: schoolId,
    },
    district_id: districtId,
    school_id: schoolId,
  });

  return result;
}
