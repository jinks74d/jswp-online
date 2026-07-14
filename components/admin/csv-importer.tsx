"use client";

/**
 * Reusable CSV importer UI — the shared two-stage flow (upload → preview →
 * confirm) for any entity registered in lib/csv-import/registry. Parameterized
 * only by `entity`; all column/validation/commit logic lives server-side in
 * the descriptor. Nothing is written until the user confirms in the preview.
 */

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { parseImport, runImport } from "@/lib/csv-import/actions";
import type { CommitOutcome, ParseOutcome } from "@/lib/csv-import/types";

export function CsvImporter({
  entity,
  sampleHeaders,
  scope = {},
}: {
  entity: string;
  sampleHeaders: string[];
  /** Parent context (e.g. { districtId }) for scoped imports. */
  scope?: Record<string, string>;
}) {
  const [preview, setPreview] = useState<ParseOutcome | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [result, setResult] = useState<CommitOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setPreview(null);
    setExcluded(new Set());
    setResult(null);
    setError(null);
  }

  function onParse(formData: FormData) {
    setError(null);
    setResult(null);
    start(async () => {
      const outcome = await parseImport(entity, formData, scope);
      setPreview(outcome);
      setExcluded(new Set());
    });
  }

  function toggle(rowNumber: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function onCommit() {
    if (!preview) return;
    const payloads = preview.rows
      .filter((r) => !excluded.has(r.rowNumber))
      .map((r) => r.payload);
    if (payloads.length === 0) {
      setError("No rows selected to import.");
      return;
    }
    setError(null);
    start(async () => {
      const outcome = await runImport(entity, payloads, scope);
      setResult(outcome);
    });
  }

  // ── Result view ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Import complete</span>
        </div>
        <p className="text-sm text-gray-700">
          {result.created} created · {result.updated} updated
          {result.errors.length > 0 && ` · ${result.errors.length} failed`}
        </p>
        {result.errors.length > 0 && (
          <ul className="text-sm text-red-700 space-y-1">
            {result.errors.map((e) => (
              <li key={`${e.rowNumber}-${e.label}`}>
                Row {e.rowNumber} ({e.label}): {e.message}
              </li>
            ))}
          </ul>
        )}

        {result.credentials && result.credentials.length > 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-800">
                Temp passwords (shown once — copy now)
              </p>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    result
                      .credentials!.map((c) => `${c.email}\t${c.password}`)
                      .join("\n")
                  )
                }
                className="text-xs font-medium text-green-700 hover:text-green-900"
              >
                Copy all
              </button>
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded bg-white border border-green-200 p-2 font-mono text-xs text-gray-700 space-y-0.5">
              {result.credentials.map((c) => (
                <div key={c.email}>
                  {c.email} · {c.password}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={reset}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Import another file
        </button>
      </div>
    );
  }

  // ── Preview view ─────────────────────────────────────────────────────
  if (preview) {
    const importable = preview.rows.filter((r) => !excluded.has(r.rowNumber));
    return (
      <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{preview.fileName}</span> —{" "}
            {preview.rows.length} valid row
            {preview.rows.length === 1 ? "" : "s"}
            {preview.errors.length > 0 &&
              `, ${preview.errors.length} skipped`}
          </div>
          <button
            type="button"
            onClick={reset}
            className="flex h-6 w-6 items-center justify-center text-gray-400 hover:text-gray-700"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        {preview.errors.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-amber-700">
              {preview.errors.length} row
              {preview.errors.length === 1 ? "" : "s"} skipped (click to view)
            </summary>
            <ul className="mt-1 space-y-0.5 text-amber-800">
              {preview.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </details>
        )}

        {preview.rows.length > 0 && (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {preview.columns.map((c) => (
                    <th key={c.key} className="px-3 py-2 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((r) => {
                  const on = !excluded.has(r.rowNumber);
                  return (
                    <tr key={r.rowNumber} className={on ? "" : "opacity-40"}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(r.rowNumber)}
                          aria-label={`Include row ${r.rowNumber}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {r.rowNumber}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={r.status} note={r.note} />
                      </td>
                      {preview.columns.map((c) => (
                        <td key={c.key} className="px-3 py-1.5 text-gray-800">
                          {r.cells[c.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={onCommit}
          disabled={pending || importable.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Import {importable.length} row{importable.length === 1 ? "" : "s"}
        </button>
      </div>
    );
  }

  // ── Upload view ──────────────────────────────────────────────────────
  return (
    <form
      action={onParse}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {error && <Banner kind="error">{error}</Banner>}
      <p className="text-xs text-gray-500">
        Expected columns:{" "}
        <code className="text-gray-700">{sampleHeaders.join(", ")}</code>.
        .csv, .xlsx, or .xls. Nothing is saved until you confirm the preview.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx,.xls"
          required
          className="block text-sm text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Preview
        </button>
      </div>
    </form>
  );
}

function StatusBadge({ status, note }: { status: string; note?: string }) {
  const map: Record<string, string> = {
    new: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    ambiguous: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        map[status] ?? "bg-gray-100 text-gray-700"
      }`}
      title={note}
    >
      {status}
    </span>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-md p-3 flex items-start gap-2 border text-sm bg-red-50 border-red-200 text-red-700"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p>{children}</p>
    </div>
  );
}
