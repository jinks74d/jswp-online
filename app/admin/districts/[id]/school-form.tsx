"use client";

/**
 * Shared school form — create (on the district detail page) and edit (on the
 * school detail page). Carries district_id so the action can scope the write.
 */

import { useState } from "react";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createSchool,
  updateSchool,
  type SchoolFormState,
} from "@/lib/actions/schools";
import {
  SCHOOL_LEVELS,
  OTHER_LEVEL,
  isCanonicalLevel,
} from "@/lib/school-levels";

const initialState: SchoolFormState = {};

export type SchoolInitial = {
  id: string;
  name: string;
  level: string | null;
  active: boolean;
};

export function SchoolForm({
  mode,
  districtId,
  initial,
}: {
  mode: "create" | "edit";
  districtId: string;
  initial?: SchoolInitial;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createSchool : updateSchool,
    initialState
  );

  // A stored level is either a canonical slug, a custom one ("Other…"), or absent.
  const initialLevel = initial?.level ?? "";
  const startsCustom = initialLevel !== "" && !isCanonicalLevel(initialLevel);
  const [choice, setChoice] = useState(startsCustom ? OTHER_LEVEL : initialLevel);
  const [custom, setCustom] = useState(startsCustom ? initialLevel : "");

  // The field actually submitted: canonical slug, the typed custom value, or "".
  const submittedLevel = choice === OTHER_LEVEL ? custom : choice;

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && (
        <Banner kind="error">{state.error}</Banner>
      )}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      <input type="hidden" name="district_id" value={districtId} />
      {mode === "edit" && initial && (
        <input type="hidden" name="school_id" value={initial.id} />
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
          School name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={255}
          defaultValue={initial?.name ?? ""}
          placeholder="e.g. Keller High School"
          className={inputClass}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1.5">
          Level
        </label>
        <select
          id="level"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={inputClass}
        >
          <option value="">— level —</option>
          {SCHOOL_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
          <option value={OTHER_LEVEL}>Other…</option>
        </select>

        {choice === OTHER_LEVEL && (
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={20}
            placeholder="e.g. Vocational Academy"
            aria-label="Custom school level"
            className={`${inputClass} mt-2`}
          />
        )}

        {/* Always submit the resolved value, regardless of which control set it. */}
        <input type="hidden" name="level" value={submittedLevel} />

        {state.fieldErrors?.level && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.level}</p>
        )}
      </div>

      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-gray-900">Active</span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "create" ? "Add school" : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

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
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <p>{children}</p>
    </div>
  );
}
