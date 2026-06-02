/**
 * Shared CSV-import types (client + server safe — pure types, no runtime).
 *
 * The importer is a shared two-stage flow (parse → preview → confirm) that any
 * entity plugs into via a descriptor (see ./descriptor.ts). These types are
 * the wire format between the server actions and the <CsvImporter> UI.
 */

export type CsvParseError = { rowNumber: number | null; message: string };

/** Hybrid-match outcome shown in the preview, re-derived authoritatively at commit. */
export type RowStatus = "new" | "update" | "ambiguous";

export type PreviewRow = {
  rowNumber: number;
  status: RowStatus;
  /** Display values keyed by display-column key. */
  cells: Record<string, string>;
  /** Why it matched (e.g. "matches subdomain"). */
  note?: string;
  /** The validated typed row, carried back to commit. Treated as untrusted there. */
  payload: unknown;
};

export type ParseOutcome = {
  entity: string;
  fileName: string;
  /** Ordered display-column labels for the preview table header. */
  columns: { key: string; label: string }[];
  rows: PreviewRow[];
  errors: CsvParseError[];
};

export type CommitRowError = {
  rowNumber: number;
  label: string;
  message: string;
};

export type CommitOutcome = {
  created: number;
  updated: number;
  skipped: number;
  errors: CommitRowError[];
};
