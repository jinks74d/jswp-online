"use client";

/**
 * Two-stage import flow:
 *   1. Upload CSV/Excel + pick class period → preview parsed rows + errors
 *   2. Confirm → run server import → results panel with credentials
 */

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import {
  parseRosterFile,
  importRoster,
  type ParseResult,
  type ImportResult,
} from "@/lib/actions/roster-import";

export type ClassPeriodOption = {
  id: string;
  label: string;
};

type Stage = "select" | "preview" | "result";

export function ImportForm({
  classPeriods,
}: {
  classPeriods: ClassPeriodOption[];
}) {
  const [stage, setStage] = useState<Stage>("select");
  const [classPeriodId, setClassPeriodId] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleParse(formData: FormData) {
    setError(null);
    if (!classPeriodId) {
      setError("Pick a class period first.");
      return;
    }
    startTransition(async () => {
      const res = await parseRosterFile(formData);
      setParseResult(res);
      setStage("preview");
    });
  }

  function handleConfirm() {
    if (!parseResult || parseResult.rows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await importRoster(
          parseResult.rows,
          classPeriodId,
          parseResult.fileName
        );
        setImportResult(res);
        setStage("result");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function reset() {
    setStage("select");
    setClassPeriodId("");
    setParseResult(null);
    setImportResult(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {stage === "select" && (
        <UploadStage
          classPeriods={classPeriods}
          classPeriodId={classPeriodId}
          onClassPeriodChange={setClassPeriodId}
          onSubmit={handleParse}
          isPending={isPending}
        />
      )}

      {stage === "preview" && parseResult && (
        <PreviewStage
          parseResult={parseResult}
          classPeriodLabel={
            classPeriods.find((p) => p.id === classPeriodId)?.label ?? ""
          }
          onBack={reset}
          onConfirm={handleConfirm}
          isPending={isPending}
        />
      )}

      {stage === "result" && importResult && (
        <ResultStage importResult={importResult} onReset={reset} />
      )}
    </div>
  );
}

/* ─── Stage 1: upload ────────────────────────────────────────────────── */

function UploadStage({
  classPeriods,
  classPeriodId,
  onClassPeriodChange,
  onSubmit,
  isPending,
}: {
  classPeriods: ClassPeriodOption[];
  classPeriodId: string;
  onClassPeriodChange: (id: string) => void;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form
      action={onSubmit}
      className="space-y-4 bg-white border border-gray-200 rounded-lg p-6"
    >
      <div>
        <label
          htmlFor="class_period_id"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Class period
        </label>
        <select
          id="class_period_id"
          name="class_period_id"
          required
          value={classPeriodId}
          onChange={(e) => onClassPeriodChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        >
          <option value="">Choose a class period…</option>
          {classPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Roster file (.csv, .xlsx, .xls — max 10MB)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls"
          required
          className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !classPeriodId}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Parsing…
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Preview file
          </>
        )}
      </button>
    </form>
  );
}

/* ─── Stage 2: preview ───────────────────────────────────────────────── */

function PreviewStage({
  parseResult,
  classPeriodLabel,
  onBack,
  onConfirm,
  isPending,
}: {
  parseResult: ParseResult;
  classPeriodLabel: string;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { rows, errors, fileName } = parseResult;
  const canImport = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-600">
          File: <span className="font-medium text-gray-900">{fileName}</span>
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Class period:{" "}
          <span className="font-medium text-gray-900">{classPeriodLabel}</span>
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Rows ready to import:{" "}
          <span className="font-semibold text-gray-900">{rows.length}</span>
          {errors.length > 0 && (
            <span className="ml-3 text-red-700">
              · {errors.length} row error{errors.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="text-sm font-medium text-red-800">
            Rows that will be skipped
          </div>
          <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
            {errors.slice(0, 25).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
            {errors.length > 25 && (
              <li>…and {errors.length - 25} more.</li>
            )}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Row</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">First</th>
                  <th className="px-3 py-2 text-left font-medium">Last</th>
                  <th className="px-3 py-2 text-left font-medium">Grade</th>
                  <th className="px-3 py-2 text-left font-medium">SIS ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-2 text-gray-500">{r.rowNumber}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.firstName}</td>
                    <td className="px-3 py-2">{r.lastName}</td>
                    <td className="px-3 py-2">{r.gradeLevel ?? "—"}</td>
                    <td className="px-3 py-2">{r.studentIdExternal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
              Showing first 50 of {rows.length} rows.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canImport || isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>Import {rows.length} student{rows.length === 1 ? "" : "s"}</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Stage 3: result ────────────────────────────────────────────────── */

function ResultStage({
  importResult,
  onReset,
}: {
  importResult: ImportResult;
  onReset: () => void;
}) {
  const { created, updated, errors, credentials } = importResult;

  function downloadCredentialsCsv() {
    const header = "email,password\n";
    const rows = credentials
      .map((c) => `${csvEscape(c.email)},${csvEscape(c.password)}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-credentials-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-green-800">
          Import complete. <strong>{created}</strong> created,{" "}
          <strong>{updated}</strong> updated, <strong>{errors.length}</strong>{" "}
          row error{errors.length === 1 ? "" : "s"}.
        </div>
      </div>

      {credentials.length > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 space-y-3">
          <div className="text-sm text-yellow-900">
            <strong>
              Copy these passwords now — they will not be shown again.
            </strong>{" "}
            Distribute them to students through your existing channel.
          </div>
          <button
            type="button"
            onClick={downloadCredentialsCsv}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-700 text-white text-sm font-medium hover:bg-yellow-800"
          >
            <Download className="w-4 h-4" />
            Download credentials.csv
          </button>
          <div className="bg-white border border-yellow-200 rounded overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-yellow-100 text-yellow-900">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Temporary password
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100 text-gray-900">
                {credentials.map((c) => (
                  <tr key={c.email}>
                    <td className="px-3 py-2">{c.email}</td>
                    <td className="px-3 py-2 font-mono">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800 mb-2">
            Row errors
          </div>
          <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e.rowNumber}>
                Row {e.rowNumber} ({e.email}): {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        Import another file
      </button>
    </div>
  );
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
