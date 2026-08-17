"use client";

/**
 * Shared class-period form — create (class detail) and edit (period detail).
 */

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createClassPeriod,
  updateClassPeriod,
  type ClassPeriodFormState,
} from "@/lib/actions/class-periods";

const initialState: ClassPeriodFormState = {};

export type PeriodInitial = {
  id: string;
  period_label: string;
  academic_year: string | null;
};

export function PeriodForm({
  mode,
  classId,
  initial,
}: {
  mode: "create" | "edit";
  classId: string;
  initial?: PeriodInitial;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createClassPeriod : updateClassPeriod,
    initialState
  );

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      {mode === "create" ? (
        <input type="hidden" name="class_id" value={classId} />
      ) : (
        initial && <input type="hidden" name="period_id" value={initial.id} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="period_label" className="block text-sm font-medium text-gray-700 mb-1.5">
            Period
          </label>
          <input
            id="period_label"
            name="period_label"
            type="text"
            required
            maxLength={50}
            defaultValue={initial?.period_label ?? ""}
            placeholder="e.g., 2 or Block 3"
            aria-invalid={!!state.fieldErrors?.period_label}
            aria-describedby={
              state.fieldErrors?.period_label ? "err-period_label" : undefined
            }
            className={inputClass}
          />
          {state.fieldErrors?.period_label && (
            <p id="err-period_label" className="mt-1 text-sm text-red-600">
              {state.fieldErrors.period_label}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="academic_year" className="block text-sm font-medium text-gray-700 mb-1.5">
            Academic year <span className="text-gray-500">(optional)</span>
          </label>
          <input
            id="academic_year"
            name="academic_year"
            type="text"
            maxLength={20}
            defaultValue={initial?.academic_year ?? ""}
            placeholder="2025-2026"
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {mode === "create" ? "Add period" : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-500 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

function Banner({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = kind === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`rounded-md p-3 flex items-start gap-2 border text-sm ${
        isError
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-green-50 border-green-200 text-green-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      )}
      <p>{children}</p>
    </div>
  );
}
