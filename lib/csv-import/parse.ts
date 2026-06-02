/**
 * Shared spreadsheet parsing for the CSV importer. Reads .csv/.xlsx/.xls into
 * a uniform `Record<normalizedHeader, sanitizedString>[]`, with the same
 * file-size cap and CSV-injection guard the roster importer uses.
 *
 * SERVER ONLY — pulls in papaparse + xlsx.
 */

import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VALUE_LENGTH = 1000;

export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

export function sanitizeCell(v: unknown): string {
  if (v == null) return "";
  // Strip leading CSV-injection prefixes (Excel/Numbers run these as formulas).
  const s = String(v).replace(/^[@=+\-]/, "");
  return s.trim().substring(0, MAX_VALUE_LENGTH);
}

function normalizeRow(
  row: Record<string, unknown>,
  normalizeKeys: boolean
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    out[normalizeKeys ? normalizeHeader(k) : k] = sanitizeCell(row[k]);
  }
  return out;
}

export type ReadResult =
  | { rawRows: Record<string, string>[]; error?: undefined }
  | { rawRows?: undefined; error: string };

export async function readSpreadsheet(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: `File exceeds the 10MB limit (${(
        file.size /
        1024 /
        1024
      ).toFixed(2)}MB).`,
    };
  }

  const ext = file.name.toLowerCase().match(/\.(csv|xlsx|xls)$/)?.[1];
  if (!ext) return { error: "File must be .csv, .xlsx, or .xls." };

  try {
    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: normalizeHeader,
      });
      if (parsed.errors.length > 0) {
        return { error: `CSV parse error: ${parsed.errors[0].message}` };
      }
      // Headers already normalized by transformHeader; sanitize values only.
      return { rawRows: parsed.data.map((r) => normalizeRow(r, false)) };
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { error: "Workbook is empty." };
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { raw: false, defval: "" }
    );
    return { rawRows: json.map((r) => normalizeRow(r, true)) };
  } catch (e) {
    return {
      error: `Failed to parse file: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    };
  }
}
