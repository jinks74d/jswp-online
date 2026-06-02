/**
 * Import descriptor interface. Each importable entity supplies one of these;
 * the shared core (parse.ts + actions.ts) drives them generically. Pure types
 * — no runtime, safe to import anywhere.
 */

import type { Database } from "@/lib/database.types";
import type { CommitOutcome } from "./types";

type JswpRole = Database["public"]["Enums"]["jswp_role"];

export interface ImportContext {
  actorId: string;
}

export interface RowMatch {
  status: "new" | "update" | "ambiguous";
  existingId?: string;
  note?: string;
}

/**
 * TRow is the entity's validated row shape (must include `rowNumber` and be
 * JSON-serializable — it crosses the client boundary in the preview payload).
 */
export interface ImportDescriptor<TRow extends { rowNumber: number }> {
  entity: string;
  /** Roles permitted to run this import. */
  roles: JswpRole[];
  /** Normalized CSV header → field key on TRow. */
  columnAliases: Record<string, keyof TRow & string>;
  /** Columns shown in the preview table, in order. */
  displayColumns: { key: keyof TRow & string; label: string }[];
  /** Example headers shown in the UI hint. */
  sampleHeaders: string[];
  /** Validate a single alias-mapped row into TRow, or return a row-level error. */
  parseRow(
    mapped: Record<string, string>,
    rowNumber: number
  ): { row?: TRow; error?: string };
  /** Stable key for within-file duplicate detection (null = don't dedupe). */
  dedupeKey(row: TRow): string | null;
  /** Read-only batch classification against the DB (parallel to input). */
  classify(rows: TRow[]): Promise<RowMatch[]>;
  /** Idempotent commit. MUST treat rows as untrusted and re-classify internally. */
  commit(rows: TRow[], ctx: ImportContext): Promise<CommitOutcome>;
}
