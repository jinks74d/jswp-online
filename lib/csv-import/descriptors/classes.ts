/**
 * Classes import descriptor — scoped to a subject (scope.subjectId). school_id
 * is derived from the subject (read via RLS, which validates scope). Match by
 * name within the subject. RLS WITH CHECK is the commit backstop.
 *
 * SERVER ONLY.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportScope } from "../types";

export type ClassRow = { rowNumber: number; name: string };

async function classifyClasses(
  rows: ClassRow[],
  scope: ImportScope
): Promise<RowMatch[]> {
  const subjectId = scope.subjectId;
  if (!subjectId) return rows.map(() => ({ status: "new" as const }));

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("subject_id", subjectId);
  if (error) {
    throw new Error(
      `Failed to load existing classes for import matching: ${error.message}`
    );
  }

  const byName = new Map<string, string>();
  for (const c of data ?? []) byName.set(c.name.trim().toLowerCase(), c.id);

  return rows.map((r): RowMatch => {
    const id = byName.get(r.name.trim().toLowerCase());
    return id
      ? { status: "update", existingId: id, note: "matches name" }
      : { status: "new" };
  });
}

export const classesDescriptor: ImportDescriptor<ClassRow> = {
  entity: "classes",
  roles: ["super_admin", "district_admin", "school_admin"],
  columnAliases: { name: "name", class: "name", class_name: "name" },
  displayColumns: [{ key: "name", label: "Name" }],
  sampleHeaders: ["name"],

  parseRow(m, rowNumber) {
    const name = (m.name ?? "").trim();
    if (!name) return { error: "missing class name" };
    return { row: { rowNumber, name } };
  },

  dedupeKey(row) {
    return `name:${row.name.toLowerCase()}`;
  },

  classify: classifyClasses,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
    const subjectId = ctx.scope.subjectId;
    if (!subjectId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.name,
        message: "No subject context for this import.",
      }));
      return out;
    }

    const supabase = await createServerClient();
    const { data: subject } = await supabase
      .from("subjects")
      .select("id, school_id")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.name,
        message: "Subject not found or outside your scope.",
      }));
      return out;
    }

    const matches = await classifyClasses(rows, ctx.scope);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = matches[i];
      try {
        if (m.status === "update" && m.existingId) {
          const { error } = await supabase
            .from("classes")
            .update({ name: r.name })
            .eq("id", m.existingId);
          if (error) throw error;
          out.updated++;
        } else {
          const { error } = await supabase.from("classes").insert({
            subject_id: subject.id,
            school_id: subject.school_id,
            name: r.name,
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

    await createAdminClient()
      .from("audit_log")
      .insert({
        actor_id: ctx.actorId,
        action: "class.import",
        target_scope: { subject_id: subject.id },
        metadata: { created: out.created, updated: out.updated, errors: out.errors },
        school_id: subject.school_id,
      });

    return out;
  },
};
