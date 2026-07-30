/**
 * Districts import descriptor — the first (simplest) consumer of the importer
 * framework: no parent to resolve. Hybrid match: subdomain first, then name.
 *
 * SERVER ONLY — touches the DB.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import type { ImportContext, ImportDescriptor, RowMatch } from "../descriptor";
import type { CommitOutcome } from "../types";

export type DistrictRow = {
  rowNumber: number;
  name: string;
  subdomain: string | null;
  contactEmail: string | null;
};

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function classifyDistricts(rows: DistrictRow[]): Promise<RowMatch[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("districts")
    .select("id, name, subdomain");
  if (error) {
    throw new Error(
      `Failed to load existing districts for import matching: ${error.message}`
    );
  }

  const bySubdomain = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const d of data ?? []) {
    if (d.subdomain) bySubdomain.set(d.subdomain.toLowerCase(), d.id);
    byName.set(d.name.trim().toLowerCase(), d.id);
  }

  return rows.map((r): RowMatch => {
    if (r.subdomain && bySubdomain.has(r.subdomain)) {
      return {
        status: "update",
        existingId: bySubdomain.get(r.subdomain),
        note: "matches subdomain",
      };
    }
    const nameKey = r.name.trim().toLowerCase();
    if (byName.has(nameKey)) {
      return { status: "update", existingId: byName.get(nameKey), note: "matches name" };
    }
    return { status: "new" };
  });
}

export const districtsDescriptor: ImportDescriptor<DistrictRow> = {
  entity: "districts",
  roles: ["super_admin"],
  columnAliases: {
    name: "name",
    district: "name",
    district_name: "name",
    subdomain: "subdomain",
    contact_email: "contactEmail",
    email: "contactEmail",
  },
  displayColumns: [
    { key: "name", label: "Name" },
    { key: "subdomain", label: "Subdomain" },
    { key: "contactEmail", label: "Contact email" },
  ],
  sampleHeaders: ["name", "subdomain", "contact_email"],

  parseRow(m, rowNumber) {
    const name = (m.name ?? "").trim();
    if (!name) return { error: "missing district name" };

    const subdomain = (m.subdomain ?? "").trim().toLowerCase() || null;
    if (subdomain && !SUBDOMAIN_RE.test(subdomain)) {
      return { error: `invalid subdomain "${subdomain}"` };
    }

    const contactEmail = (m.contactEmail ?? "").trim() || null;
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return { error: `invalid contact email "${contactEmail}"` };
    }

    return { row: { rowNumber, name, subdomain, contactEmail } };
  },

  dedupeKey(row) {
    return row.subdomain ? `sub:${row.subdomain}` : `name:${row.name.toLowerCase()}`;
  },

  classify: classifyDistricts,

  async commit(rows, ctx: ImportContext): Promise<CommitOutcome> {
    // Re-classify against the live DB — the client-sent status is advisory only.
    const matches = await classifyDistricts(rows);
    const supabase = await createServerClient();
    const out: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = matches[i];
      try {
        if (m.status === "update" && m.existingId) {
          const { error } = await supabase
            .from("districts")
            .update({
              name: r.name,
              subdomain: r.subdomain,
              contact_email: r.contactEmail,
            })
            .eq("id", m.existingId);
          if (error) throw error;
          out.updated++;
        } else {
          const { error } = await supabase.from("districts").insert({
            name: r.name,
            subdomain: r.subdomain,
            contact_email: r.contactEmail,
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

    await writeAuditLog({
      actor_id: ctx.actorId,
      action: "district.import",
      target_scope: {},
      metadata: {
        created: out.created,
        updated: out.updated,
        errors: out.errors,
      },
      district_id: null,
      school_id: null,
    });

    return out;
  },
};
