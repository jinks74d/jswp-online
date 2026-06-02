"use client";

/**
 * Shared district form — create (on the list page) and edit (on the detail
 * page). Create omits the active toggle (new districts start active);
 * edit includes it + a hidden district_id.
 */

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createDistrict,
  updateDistrict,
  type DistrictFormState,
} from "@/lib/actions/districts";

const initialState: DistrictFormState = {};

export type DistrictInitial = {
  id: string;
  name: string;
  subdomain: string | null;
  contact_email: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  active: boolean;
};

export function DistrictForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: DistrictInitial;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createDistrict : updateDistrict,
    initialState
  );

  return (
    <form
      action={action}
      className="space-y-4 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      {mode === "edit" && initial && (
        <input type="hidden" name="district_id" value={initial.id} />
      )}

      <Field label="District name" htmlFor="name" error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={255}
          defaultValue={initial?.name ?? ""}
          placeholder="e.g. Los Angeles County Office of Education"
          className={inputClass}
        />
      </Field>

      <Field
        label="Subdomain"
        htmlFor="subdomain"
        error={state.fieldErrors?.subdomain}
        hint="optional"
      >
        <div className="flex items-center">
          <input
            id="subdomain"
            name="subdomain"
            type="text"
            maxLength={63}
            defaultValue={initial?.subdomain ?? ""}
            placeholder="lacoe"
            className={`${inputClass} rounded-r-none`}
          />
          <span className="inline-flex items-center px-3 py-2 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-sm text-gray-500">
            .jswponline.com
          </span>
        </div>
      </Field>

      <Field
        label="Contact email"
        htmlFor="contact_email"
        error={state.fieldErrors?.contact_email}
        hint="optional"
      >
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={initial?.contact_email ?? ""}
          placeholder="admin@district.org"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Primary color"
          htmlFor="primary_color"
          error={state.fieldErrors?.primary_color}
          hint="hex"
        >
          <input
            id="primary_color"
            name="primary_color"
            type="text"
            defaultValue={initial?.primary_color ?? ""}
            placeholder="#1E40AF"
            className={inputClass}
          />
        </Field>
        <Field
          label="Secondary color"
          htmlFor="secondary_color"
          error={state.fieldErrors?.secondary_color}
          hint="hex"
        >
          <input
            id="secondary_color"
            name="secondary_color"
            type="text"
            defaultValue={initial?.secondary_color ?? ""}
            placeholder="#9333EA"
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Logo URL"
        htmlFor="logo_url"
        error={state.fieldErrors?.logo_url}
        hint="optional"
      >
        <input
          id="logo_url"
          name="logo_url"
          type="url"
          defaultValue={initial?.logo_url ?? ""}
          placeholder="https://…/logo.png"
          className={inputClass}
        />
      </Field>

      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-gray-900">Active</span>
          <span className="text-gray-600">
            (inactive districts can&apos;t be used to sign in)
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "create" ? "Create district" : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <p>{children}</p>
    </div>
  );
}
