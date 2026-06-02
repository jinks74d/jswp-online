/**
 * Class-students import descriptor — scoped to a class period
 * (scope.classPeriodId). Generalizes the roster importer: find-or-create the
 * student account (temp password surfaced as a credential) and enroll them into
 * the period. Idempotent — re-importing updates PII + re-activates a soft-
 * unenrolled row rather than duplicating.
 *
 * SERVER ONLY.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedUser } from "@/lib/scoped-users";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportCredential } from "../types";

export type ClassStudentRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevel: string | null;
  studentIdExternal: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function classifyByEmail(rows: ClassStudentRow[]): Promise<RowMatch[]> {
  const supabase = await createServerClient();
  const emails = rows.map((r) => r.email);
  const { data } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("email", emails.length ? emails : ["__none__"]);

  const byEmail = new Map<string, string>();
  for (const u of data ?? []) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);

  return rows.map((r): RowMatch => {
    const id = byEmail.get(r.email);
    return id
      ? { status: "update", existingId: id, note: "existing account" }
      : { status: "new" };
  });
}

export const classStudentsDescriptor: ImportDescriptor<ClassStudentRow> = {
  entity: "class_students",
  roles: ["super_admin", "district_admin", "school_admin"],
  columnAliases: {
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
  },
  displayColumns: [
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "gradeLevel", label: "Grade" },
  ],
  sampleHeaders: ["first_name", "last_name", "email", "grade_level"],

  parseRow(m, rowNumber) {
    const firstName = (m.firstName ?? "").trim();
    const lastName = (m.lastName ?? "").trim();
    const email = (m.email ?? "").trim().toLowerCase();
    if (!firstName || !lastName) return { error: "missing first or last name" };
    if (!EMAIL_RE.test(email)) return { error: `invalid email "${email}"` };
    return {
      row: {
        rowNumber,
        firstName,
        lastName,
        email,
        gradeLevel: (m.gradeLevel ?? "").trim() || null,
        studentIdExternal: (m.studentIdExternal ?? "").trim() || null,
      },
    };
  },

  dedupeKey(row) {
    return `email:${row.email}`;
  },

  classify: classifyByEmail,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
    const credentials: ImportCredential[] = [];

    const periodId = ctx.scope.classPeriodId;
    if (!periodId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.email,
        message: "No class-period context for this import.",
      }));
      return out;
    }

    // RLS scope gate: read the period + its district (via the school).
    const supabase = await createServerClient();
    const { data: period } = await supabase
      .from("class_periods")
      .select("id, school_id, school:school_id(district_id)")
      .eq("id", periodId)
      .maybeSingle();
    const schoolId = (period as { school_id?: string } | null)?.school_id;
    const districtId = (
      period as { school?: { district_id?: string } } | null
    )?.school?.district_id;
    if (!period || !schoolId || !districtId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.email,
        message: "Class period not found or outside your scope.",
      }));
      return out;
    }

    const admin = createAdminClient();

    for (const r of rows) {
      try {
        const { data: existing } = await admin
          .from("user_profiles")
          .select("id, role, district_id")
          .eq("email", r.email)
          .maybeSingle();

        let studentId: string;
        if (existing) {
          if (existing.role !== "student") {
            throw new Error(`email exists with role "${existing.role}"`);
          }
          if (existing.district_id !== districtId) {
            throw new Error("email exists in a different district");
          }
          const { error } = await admin
            .from("user_profiles")
            .update({
              first_name: r.firstName,
              last_name: r.lastName,
              grade_level: r.gradeLevel,
              student_id_external: r.studentIdExternal,
              school_id: schoolId,
            })
            .eq("id", existing.id);
          if (error) throw error;
          studentId = existing.id;
          out.updated++;
        } else {
          const res = await createScopedUser({
            role: "student",
            districtId,
            schoolId,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            gradeLevel: r.gradeLevel,
            studentIdExternal: r.studentIdExternal,
          });
          if (!res.ok) throw new Error(res.error);
          studentId = res.userId;
          out.created++;
          credentials.push({
            label: `${r.firstName} ${r.lastName}`,
            email: r.email,
            password: res.password,
          });
        }

        // Enroll (idempotent) — re-activates a soft-unenrolled row.
        const { error: enrollErr } = await admin
          .from("class_student_enrollments")
          .upsert(
            { class_period_id: periodId, student_id: studentId, unenrolled_at: null },
            { onConflict: "class_period_id,student_id" }
          );
        if (enrollErr) throw enrollErr;
      } catch (e) {
        out.errors.push({
          rowNumber: r.rowNumber,
          label: r.email,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (credentials.length) out.credentials = credentials;

    await admin.from("audit_log").insert({
      actor_id: ctx.actorId,
      action: "class_period.import_students",
      target_scope: { class_period_id: periodId },
      metadata: { created: out.created, updated: out.updated, errors: out.errors },
      district_id: districtId,
      school_id: schoolId,
    });

    return out;
  },
};
