/**
 * Schools import descriptor — scoped to a district (scope.districtId, supplied
 * by the district detail page the importer is mounted on). Match by name
 * within that district. RLS (schools_admin_manage) is the backstop on commit.
 *
 * SERVER ONLY — touches the DB.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome, ImportScope } from "../types";
import { normalizeSchoolLevel } from "@/lib/school-levels";

export type SchoolRow = {
  rowNumber: number;
  name: string;
  level: string | null;
};

async function classifySchools(
  rows: SchoolRow[],
  scope: ImportScope
): Promise<RowMatch[]> {
  const districtId = scope.districtId;
  if (!districtId) return rows.map(() => ({ status: "new" as const }));

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("schools")
    .select("id, name")
    .eq("district_id", districtId);

  const byName = new Map<string, string>();
  for (const s of data ?? []) byName.set(s.name.trim().toLowerCase(), s.id);

  return rows.map((r): RowMatch => {
    const id = byName.get(r.name.trim().toLowerCase());
    return id
      ? { status: "update", existingId: id, note: "matches name" }
      : { status: "new" };
  });
}

export const schoolsDescriptor: ImportDescriptor<SchoolRow> = {
  entity: "schools",
  roles: ["super_admin", "district_admin"],
  columnAliases: {
    name: "name",
    school: "name",
    school_name: "name",
    level: "level",
    grade_level: "level",
  },
  displayColumns: [
    { key: "name", label: "Name" },
    { key: "level", label: "Level" },
  ],
  sampleHeaders: ["name", "level"],

  parseRow(m, rowNumber) {
    const name = (m.name ?? "").trim();
    if (!name) return { error: "missing school name" };

    // Canonical slugs pass through; any other text is slugified and capped to
    // the 20-char column. Only blank-after-normalize is an error.
    const levelRaw = (m.level ?? "").trim();
    const level = normalizeSchoolLevel(levelRaw);
    if (levelRaw && !level) {
      return { error: `invalid level "${levelRaw}"` };
    }

    return { row: { rowNumber, name, level } };
  },

  dedupeKey(row) {
    return `name:${row.name.toLowerCase()}`;
  },

  classify: classifySchools,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
    const districtId = ctx.scope.districtId;
    if (!districtId) {
      out.errors = rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.name,
        message: "No district context for this import.",
      }));
      return out;
    }

    const matches = await classifySchools(rows, ctx.scope);
    const supabase = await createServerClient();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = matches[i];
      try {
        if (m.status === "update" && m.existingId) {
          const { error } = await supabase
            .from("schools")
            .update({ name: r.name, level: r.level })
            .eq("id", m.existingId);
          if (error) throw error;
          out.updated++;
        } else {
          const { error } = await supabase.from("schools").insert({
            district_id: districtId,
            name: r.name,
            level: r.level,
            active: true,
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
        action: "school.import",
        target_scope: { district_id: districtId },
        metadata: {
          created: out.created,
          updated: out.updated,
          errors: out.errors,
        },
        district_id: districtId,
        school_id: null,
      });

    return out;
  },
};
