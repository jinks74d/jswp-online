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

type PocInitial = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

export type DistrictInitial = {
  id: string;
  name: string;
  subdomain: string | null;
  contact_email: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  active: boolean;
  primaryPoc?: PocInitial;
  secondaryPoc?: PocInitial;
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
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={state.fieldErrors?.name ? "err-name" : undefined}
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
            aria-invalid={!!state.fieldErrors?.subdomain}
            aria-describedby={describedBy("subdomain", {
              hint: true,
              error: !!state.fieldErrors?.subdomain,
            })}
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
          aria-invalid={!!state.fieldErrors?.contact_email}
          aria-describedby={describedBy("contact_email", {
            hint: true,
            error: !!state.fieldErrors?.contact_email,
          })}
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
            aria-invalid={!!state.fieldErrors?.primary_color}
            aria-describedby={describedBy("primary_color", {
              hint: true,
              error: !!state.fieldErrors?.primary_color,
            })}
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
            aria-invalid={!!state.fieldErrors?.secondary_color}
            aria-describedby={describedBy("secondary_color", {
              hint: true,
              error: !!state.fieldErrors?.secondary_color,
            })}
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
          aria-invalid={!!state.fieldErrors?.logo_url}
          aria-describedby={describedBy("logo_url", {
            hint: true,
            error: !!state.fieldErrors?.logo_url,
          })}
          className={inputClass}
        />
      </Field>

      <fieldset className="border-t border-gray-200 pt-4 mt-2 space-y-5">
        <legend className="text-sm font-semibold text-gray-900">
          Points of Contact
          <span className="ml-2 font-normal text-xs text-gray-500">
            {mode === "create"
              ? "both required — each becomes a district admin you can invite"
              : "edit contact details, or add a contact if one is missing"}
          </span>
        </legend>
        <PocFields
          prefix="primary"
          label="Primary POC"
          state={state}
          required={mode === "create"}
          initial={initial?.primaryPoc}
        />
        <PocFields
          prefix="secondary"
          label="Secondary POC"
          state={state}
          required={mode === "create"}
          initial={initial?.secondaryPoc}
        />
      </fieldset>

      {mode === "edit" && (
        <label htmlFor="active" className="flex items-center gap-2 text-sm">
          <input
            id="active"
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
        {pending && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {mode === "create" ? "Create district" : "Save changes"}
      </button>
    </form>
  );
}

function PocFields({
  prefix,
  label,
  state,
  required,
  initial,
}: {
  prefix: "primary" | "secondary";
  label: string;
  state: DistrictFormState;
  required: boolean;
  initial?: PocInitial;
}) {
  const fe = state.fieldErrors;
  const k = (name: string) => `${prefix}_poc_${name}`;
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          htmlFor={k("first_name")}
          error={fe?.[`${prefix}_poc_first_name`]}
        >
          <input
            id={k("first_name")}
            name={k("first_name")}
            type="text"
            required={required}
            maxLength={100}
            defaultValue={initial?.first_name ?? ""}
            aria-invalid={!!fe?.[`${prefix}_poc_first_name`]}
            aria-describedby={
              fe?.[`${prefix}_poc_first_name`] ? `err-${k("first_name")}` : undefined
            }
            className={inputClass}
          />
        </Field>
        <Field
          label="Last name"
          htmlFor={k("last_name")}
          error={fe?.[`${prefix}_poc_last_name`]}
        >
          <input
            id={k("last_name")}
            name={k("last_name")}
            type="text"
            required={required}
            maxLength={100}
            defaultValue={initial?.last_name ?? ""}
            aria-invalid={!!fe?.[`${prefix}_poc_last_name`]}
            aria-describedby={
              fe?.[`${prefix}_poc_last_name`] ? `err-${k("last_name")}` : undefined
            }
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Email" htmlFor={k("email")} error={fe?.[`${prefix}_poc_email`]}>
        <input
          id={k("email")}
          name={k("email")}
          type="email"
          required={required}
          maxLength={255}
          defaultValue={initial?.email ?? ""}
          placeholder="name@district.org"
          aria-invalid={!!fe?.[`${prefix}_poc_email`]}
          aria-describedby={fe?.[`${prefix}_poc_email`] ? `err-${k("email")}` : undefined}
          className={inputClass}
        />
      </Field>
      <Field label="Phone" htmlFor={k("phone")} error={fe?.[`${prefix}_poc_phone`]}>
        <input
          id={k("phone")}
          name={k("phone")}
          type="tel"
          required={required}
          maxLength={32}
          defaultValue={initial?.phone ?? ""}
          placeholder="(555) 123-4567"
          aria-invalid={!!fe?.[`${prefix}_poc_phone`]}
          aria-describedby={fe?.[`${prefix}_poc_phone`] ? `err-${k("phone")}` : undefined}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

/** Space-separated hint+error id list for a field's aria-describedby. */
function describedBy(
  key: string,
  opts: { hint?: boolean; error?: boolean }
): string | undefined {
  const ids = [
    opts.hint ? `hint-${key}` : null,
    opts.error ? `err-${key}` : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

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
        {hint && (
          <span id={`hint-${htmlFor}`} className="text-xs text-gray-500">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`err-${htmlFor}`} className="mt-1 text-sm text-red-600">
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
