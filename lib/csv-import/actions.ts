/**
 * Generic CSV-import server actions. Both look the descriptor up by `entity`
 * and re-gate via requireRole(descriptor.roles), so the entity string from the
 * client can never widen access.
 *
 *   parseImport(entity, formData) — read-only: parse → validate → classify.
 *     No writes. Returns a preview the UI renders before anything is committed.
 *   runImport(entity, payloads)   — commit the (client-selected) rows. The
 *     descriptor re-classifies against the live DB, so client-sent status is
 *     never trusted.
 */

"use server";

import "server-only";

import { requireRole } from "@/lib/auth";
import { readSpreadsheet } from "./parse";
import { getDescriptor } from "./registry";
import type { CommitOutcome, CsvParseError, ParseOutcome, PreviewRow } from "./types";

function failed(entity: string, message: string, fileName = ""): ParseOutcome {
  return { entity, fileName, columns: [], rows: [], errors: [{ rowNumber: null, message }] };
}

export async function parseImport(
  entity: string,
  formData: FormData
): Promise<ParseOutcome> {
  const descriptor = getDescriptor(entity);
  if (!descriptor) return failed(entity, "Unknown import type.");
  await requireRole(descriptor.roles);

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return failed(entity, "No file provided.");
  }

  const read = await readSpreadsheet(file);
  if (!read.rawRows) {
    return failed(entity, read.error ?? "Could not parse file.", file.name);
  }
  if (read.rawRows.length === 0) {
    return failed(entity, "No data rows found after the header.", file.name);
  }

  const typed: { rowNumber: number }[] = [];
  const errors: CsvParseError[] = [];
  const seen = new Map<string, number>();

  let rowNumber = 1; // header row is 1
  for (const raw of read.rawRows) {
    rowNumber++;

    const mapped: Record<string, string> = {};
    for (const header of Object.keys(raw)) {
      const field = descriptor.columnAliases[header];
      if (field) mapped[field] = raw[header];
    }

    const res = descriptor.parseRow(mapped, rowNumber);
    if (res.error || !res.row) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: ${res.error}` });
      continue;
    }

    const key = descriptor.dedupeKey(res.row);
    if (key) {
      const prev = seen.get(key);
      if (prev) {
        errors.push({
          rowNumber,
          message: `Row ${rowNumber}: duplicate of row ${prev} in this file.`,
        });
        continue;
      }
      seen.set(key, rowNumber);
    }

    typed.push(res.row);
  }

  const matches = await descriptor.classify(typed);

  const rows: PreviewRow[] = typed.map((row, i) => {
    const cells: Record<string, string> = {};
    for (const col of descriptor.displayColumns) {
      const v = (row as Record<string, unknown>)[col.key];
      cells[col.key] = v == null ? "" : String(v);
    }
    return {
      rowNumber: row.rowNumber,
      status: matches[i]?.status ?? "new",
      cells,
      note: matches[i]?.note,
      payload: row,
    };
  });

  return {
    entity,
    fileName: file.name,
    columns: descriptor.displayColumns.map((c) => ({ key: c.key, label: c.label })),
    rows,
    errors,
  };
}

export async function runImport(
  entity: string,
  payloads: unknown[]
): Promise<CommitOutcome> {
  const descriptor = getDescriptor(entity);
  if (!descriptor) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [{ rowNumber: 0, label: "", message: "Unknown import type." }],
    };
  }
  const actor = await requireRole(descriptor.roles);

  // Payloads are the typed rows from parseImport, but treated as untrusted:
  // the descriptor's commit re-classifies against the live DB and writes under
  // RLS, so a crafted payload can do no more than the actor's role already can.
  return descriptor.commit(payloads as { rowNumber: number }[], {
    actorId: actor.id,
  });
}
