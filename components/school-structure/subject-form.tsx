"use client";

/**
 * Shared subject form — create (subjects list) and edit (subject detail).
 */

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createSubject,
  updateSubject,
  type SubjectFormState,
} from "@/lib/actions/subjects";

const initialState: SubjectFormState = {};

export type SubjectInitial = {
  id: string;
  name: string;
  description: string | null;
};

export function SubjectForm({
  mode,
  schoolId,
  initial,
}: {
  mode: "create" | "edit";
  schoolId: string;
  initial?: SubjectInitial;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createSubject : updateSubject,
    initialState
  );

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && (
        <Banner kind="error">{state.error}</Banner>
      )}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      <input type="hidden" name="school_id" value={schoolId} />
      {mode === "edit" && initial && (
        <input type="hidden" name="subject_id" value={initial.id} />
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Subject name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={255}
          defaultValue={initial?.name ?? ""}
          placeholder="e.g., English"
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={state.fieldErrors?.name ? "err-name" : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.name && (
          <p id="err-name" className="mt-1 text-sm text-red-600">
            {state.fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={initial?.description ?? ""}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {mode === "create" ? "Add subject" : "Save changes"}
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
