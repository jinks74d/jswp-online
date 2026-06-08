/**
 * Factory for school-scoped people importers (school admins, teachers). Each
 * role differs only in its enum value + audit action + the conflict check, so
 * one factory produces all of them. Scoped to scope.schoolId; creates accounts
 * via createScopedUser and surfaces temp passwords as credentials.
 *
 * SERVER ONLY.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedUser } from "@/lib/scoped-users";
import { DEFAULT_ADMIN_KIND } from "@/lib/admin-kinds";
import type { Database } from "@/lib/database.types";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportCredential } from "../types";

type JswpRole = Database["public"]["Enums"]["jswp_role"];

export type SchoolUserRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function classifyByEmail(rows: SchoolUserRow[]): Promise<RowMatch[]> {
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

export function makeSchoolUserDescriptor(opts: {
  entity: string;
  role: "school_admin" | "teacher";
  roles: JswpRole[];
  auditAction: string;
}): ImportDescriptor<SchoolUserRow> {
  return {
    entity: opts.entity,
    roles: opts.roles,
    columnAliases: {
      first_name: "firstName",
      firstname: "firstName",
      last_name: "lastName",
      lastname: "lastName",
      email: "email",
    },
    displayColumns: [
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
      { key: "email", label: "Email" },
    ],
    sampleHeaders: ["first_name", "last_name", "email"],

    parseRow(m, rowNumber) {
      const firstName = (m.firstName ?? "").trim();
      const lastName = (m.lastName ?? "").trim();
      const email = (m.email ?? "").trim().toLowerCase();
      if (!firstName || !lastName) return { error: "missing first or last name" };
      if (!EMAIL_RE.test(email)) return { error: `invalid email "${email}"` };
      return { row: { rowNumber, firstName, lastName, email } };
    },

    dedupeKey(row) {
      return `email:${row.email}`;
    },

    classify: classifyByEmail,

    async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
      const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
      const credentials: ImportCredential[] = [];

      const schoolId = ctx.scope.schoolId;
      if (!schoolId) {
        out.errors = rows.map((r) => ({
          rowNumber: r.rowNumber,
          label: r.email,
          message: "No school context for this import.",
        }));
        return out;
      }

      // RLS scope gate — actor must be able to read the school.
      const supabase = await createServerClient();
      const { data: school } = await supabase
        .from("schools")
        .select("id, district_id")
        .eq("id", schoolId)
        .maybeSingle();
      if (!school) {
        out.errors = rows.map((r) => ({
          rowNumber: r.rowNumber,
          label: r.email,
          message: "School not found or outside your scope.",
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

          if (existing) {
            if (existing.role !== opts.role) {
              throw new Error(`email exists with role "${existing.role}"`);
            }
            if (existing.district_id !== school.district_id) {
              throw new Error("email exists in a different district");
            }
            const { error } = await admin
              .from("user_profiles")
              .update({
                first_name: r.firstName,
                last_name: r.lastName,
                school_id: school.id,
              })
              .eq("id", existing.id);
            if (error) throw error;
            out.updated++;
          } else {
            const res = await createScopedUser({
              role: opts.role,
              districtId: school.district_id,
              schoolId: school.id,
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              // CSV-imported admins default to Administrator; a per-row kind
              // column is a possible follow-up. Ignored for teachers.
              adminKind: opts.role === "school_admin" ? DEFAULT_ADMIN_KIND : null,
            });
            if (!res.ok) throw new Error(res.error);
            out.created++;
            credentials.push({
              label: `${r.firstName} ${r.lastName}`,
              email: r.email,
              password: res.password,
            });
          }
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
        action: opts.auditAction,
        target_scope: { school_id: school.id },
        metadata: { created: out.created, updated: out.updated, errors: out.errors },
        district_id: school.district_id,
        school_id: school.id,
      });

      return out;
    },
  };
}
