/**
 * Subjects import descriptor — scoped to a school (scope.schoolId). Match by
 * name within the school. Writes go through the RLS server client; its
 * subjects_admin_manage WITH CHECK is the scope backstop, so an out-of-scope
 * schoolId simply fails the insert.
 *
 * SERVER ONLY.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportScope } from "../types";

export type SubjectRow = {
  rowNumber: number;
  name: string;
  description: string | null;
};

async function classifySubjects(
  rows: SubjectRow[],
  scope: ImportScope
): Promise<RowMatch[]> {
  const schoolId = scope.schoolId;
  if (!schoolId) return rows.map(() => ({ status: "new" as const }));

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId);
  if (error) {
    throw new Error(
      `Failed to load existing subjects for import matching: ${error.message}`
    );
  }

  const byName = new Map<string, string>();
  for (const s of data ?? []) byName.set(s.name.trim().toLowerCase(), s.id);

  return rows.map((r): RowMatch => {
    const id = byName.get(r.name.trim().toLowerCase());
    return id
      ? { status: "update", existingId: id, note: "matches name" }
      : { status: "new" };
  });
}

export const subjectsDescriptor: ImportDescriptor<SubjectRow> = {
  entity: "subjects",
  roles: ["super_admin", "district_admin", "school_admin"],
  columnAliases: {
    name: "name",
    subject: "name",
    subject_name: "name",
    description: "description",
  },
  displayColumns: [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
  ],
  sampleHeaders: ["name", "description"],

  parseRow(m, rowNumber) {
    const name = (m.name ?? "").trim();
    if (!name) return { error: "missing subject name" };
    const description = (m.description ?? "").trim() || null;
    return { row: { rowNumber, name, description } };
  },

  dedupeKey(row) {
    return `name:${row.name.toLowerCase()}`;
  },

  classify: classifySubjects,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
    const schoolId = ctx.scope.schoolId;
    if (!schoolId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.name,
        message: "No school context for this import.",
      }));
      return out;
    }

    const matches = await classifySubjects(rows, ctx.scope);
    const supabase = await createServerClient();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = matches[i];
      try {
        if (m.status === "update" && m.existingId) {
          const { error } = await supabase
            .from("subjects")
            .update({ name: r.name, description: r.description })
            .eq("id", m.existingId);
          if (error) throw error;
          out.updated++;
        } else {
          const { error } = await supabase.from("subjects").insert({
            school_id: schoolId,
            name: r.name,
            description: r.description,
          });
          if (error) throw error;
          out.created++;
        }
      } catch (e) {
        out.errors.push({
          rowNumber: r.rowNumber,
          label: r.name,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await writeAuditLog({
      actor_id: ctx.actorId,
      action: "subject.import",
      target_scope: { school_id: schoolId },
      metadata: { created: out.created, updated: out.updated, errors: out.errors },
      school_id: schoolId,
    });

    return out;
  },
};
