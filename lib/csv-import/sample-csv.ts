/**
 * Builds the downloadable "example CSV" offered next to each importer, so an
 * admin can start from a correctly-shaped file instead of guessing headers.
 *
 * Pure string work — no DOM, no server. The importer component turns the
 * result into a Blob; tests exercise the quoting rules directly.
 */

/** Characters that force a field to be quoted (RFC 4180 + leading/trailing space). */
function needsQuoting(field: string): boolean {
  return (
    field.includes('"') ||
    field.includes(",") ||
    field.includes("\n") ||
    field.includes("\r") ||
    field !== field.trim()
  );
}

/** Quote and escape a single field per RFC 4180 (internal quotes doubled). */
export function escapeCsvField(field: string): string {
  if (!needsQuoting(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

/**
 * Serialize headers + rows to CSV text.
 *
 * CRLF line endings and a UTF-8 BOM, because these files are opened in Excel
 * far more often than in a text editor — without the BOM Excel mis-decodes
 * non-ASCII names, and the district data is full of them.
 *
 * Short rows are padded to the header count so a ragged sample can't produce a
 * file whose columns silently shift.
 */
export function buildSampleCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[] = []
): string {
  const line = (cells: readonly string[]) =>
    cells.map((c) => escapeCsvField(c ?? "")).join(",");

  const padded = rows.map((r) => {
    const cells = [...r];
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });

  const body = [line(headers), ...padded.map(line)].join("\r\n");
  return `﻿${body}\r\n`;
}

/** `schools` → `schools-example.csv`; safe for a download attribute. */
export function sampleCsvFilename(entity: string): string {
  const slug =
    entity
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "import";
  return `${slug}-example.csv`;
}
