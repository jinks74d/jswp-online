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
import { isValidHexColor } from "@/lib/district-branding.types";

const initialState: SchoolFormState = {};

export type SchoolInitial = {
  id: string;
  name: string;
  level: string | null;
  active: boolean;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
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
        <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1.5">
          Level
        </label>
        <select
          id="level"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-invalid={!!state.fieldErrors?.level}
          aria-describedby={state.fieldErrors?.level ? "err-level" : undefined}
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
          <p id="err-level" className="mt-1 text-sm text-red-600">
            {state.fieldErrors.level}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="address" className="text-sm font-medium text-gray-700">
            Address
          </label>
          <span className="text-xs text-gray-500">optional</span>
        </div>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={500}
          defaultValue={initial?.address ?? ""}
          placeholder="e.g. 800 N. White Chapel Blvd, Southlake, TX"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ColorField
          name="primary_color"
          label="Primary color"
          defaultValue={initial?.primary_color ?? ""}
          placeholder="#1E40AF"
          error={state.fieldErrors?.primary_color}
        />
        <ColorField
          name="secondary_color"
          label="Secondary color"
          defaultValue={initial?.secondary_color ?? ""}
          placeholder="#9333EA"
          error={state.fieldErrors?.secondary_color}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="logo_url" className="text-sm font-medium text-gray-700">
            Logo URL
          </label>
          <span className="text-xs text-gray-500">optional</span>
        </div>
        <input
          id="logo_url"
          name="logo_url"
          type="url"
          defaultValue={initial?.logo_url ?? ""}
          placeholder="https://…/logo.png"
          aria-invalid={!!state.fieldErrors?.logo_url}
          aria-describedby={state.fieldErrors?.logo_url ? "err-logo_url" : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.logo_url && (
          <p id="err-logo_url" className="mt-1 text-sm text-red-600">
            {state.fieldErrors.logo_url}
          </p>
        )}
      </div>

      {mode === "edit" && (
        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm">
          <input
            id="active"
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="peer sr-only"
          />
          <span
            className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-500"
            aria-hidden="true"
          />
          <span className="font-medium text-gray-900">Active</span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {pending && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {mode === "create" ? "Add school" : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-400 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500";

function ColorField({
  name,
  label,
  defaultValue,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const swatch = isValidHexColor(value) ? value : null;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        <span className="text-xs text-gray-500">hex</span>
      </div>
      <div className="flex items-stretch">
        <span
          className="w-10 shrink-0 rounded-l-md border border-r-0 border-gray-300"
          style={{
            backgroundColor: swatch ?? undefined,
            backgroundImage: swatch
              ? undefined
              : "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#e5e7eb 4px,#e5e7eb 8px)",
          }}
          aria-hidden="true"
        />
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `err-${name}` : undefined}
          className={`${inputClass} rounded-l-none`}
        />
      </div>
      {error && (
        <p id={`err-${name}`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

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
