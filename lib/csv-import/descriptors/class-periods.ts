/**
 * Class-periods import descriptor — scoped to a class (scope.classId). school_id
 * derived from the class (read via RLS). Match by (period_label, academic_year)
 * within the class. RLS WITH CHECK is the commit backstop. Teacher assignment is
 * done via the period detail UI, not this import.
 *
 * SERVER ONLY.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportScope } from "../types";

export type ClassPeriodRow = {
  rowNumber: number;
  periodLabel: string;
  academicYear: string | null;
};

function key(label: string, year: string | null): string {
  return `${label.trim().toLowerCase()}|${(year ?? "").trim().toLowerCase()}`;
}

async function classifyPeriods(
  rows: ClassPeriodRow[],
  scope: ImportScope
): Promise<RowMatch[]> {
  const classId = scope.classId;
  if (!classId) return rows.map(() => ({ status: "new" as const }));

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_periods")
    .select("id, period_label, academic_year")
    .eq("class_id", classId);
  if (error) {
    throw new Error(
      `Failed to load existing class periods for import matching: ${error.message}`
    );
  }

  const byKey = new Map<string, string>();
  for (const p of data ?? [])
    byKey.set(key(p.period_label, p.academic_year), p.id);

  return rows.map((r): RowMatch => {
    const id = byKey.get(key(r.periodLabel, r.academicYear));
    return id
      ? { status: "update", existingId: id, note: "matches period + year" }
      : { status: "new" };
  });
}

export const classPeriodsDescriptor: ImportDescriptor<ClassPeriodRow> = {
  entity: "class_periods",
  roles: ["super_admin", "district_admin", "school_admin"],
  columnAliases: {
    period_label: "periodLabel",
    period: "periodLabel",
    label: "periodLabel",
    academic_year: "academicYear",
    year: "academicYear",
  },
  displayColumns: [
    { key: "periodLabel", label: "Period" },
    { key: "academicYear", label: "Academic year" },
  ],
  sampleHeaders: ["period_label", "academic_year"],

  parseRow(m, rowNumber) {
    const periodLabel = (m.periodLabel ?? "").trim();
    if (!periodLabel) return { error: "missing period label" };
    const academicYear = (m.academicYear ?? "").trim() || null;
    return { row: { rowNumber, periodLabel, academicYear } };
  },

  dedupeKey(row) {
    return key(row.periodLabel, row.academicYear);
  },

  classify: classifyPeriods,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
    const classId = ctx.scope.classId;
    if (!classId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.periodLabel,
        message: "No class context for this import.",
      }));
      return out;
    }

    const supabase = await createServerClient();
    const { data: klass } = await supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", classId)
      .maybeSingle();
    if (!klass) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.periodLabel,
        message: "Class not found or outside your scope.",
      }));
      return out;
    }

    const matches = await classifyPeriods(rows, ctx.scope);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = matches[i];
      try {
        if (m.status === "update" && m.existingId) {
          // (period_label, academic_year) is the match key — nothing else to
          // update; treat as a no-op success.
          out.updated++;
        } else {
          const { error } = await supabase.from("class_periods").insert({
            class_id: klass.id,
            school_id: klass.school_id,
            period_label: r.periodLabel,
            academic_year: r.academicYear,
            created_by: ctx.actorId,
          });
          if (error) throw error;
          out.created++;
        }
      } catch (e) {
        out.errors.push({
          rowNumber: r.rowNumber,
          label: r.periodLabel,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await writeAuditLog({
      actor_id: ctx.actorId,
      action: "class_period.import",
      target_scope: { class_id: klass.id },
      metadata: { created: out.created, updated: out.updated, errors: out.errors },
      school_id: klass.school_id,
    });

    return out;
  },
};
