"use client";

/**
 * Shared district form — used inside the New-district and Edit-district modals.
 * Grouped into District details / Branding / Points of contact sections, with a
 * Cancel + Save footer. Create mode omits the Active toggle (new districts start
 * active) and uses an empty initial; edit mode prefills and carries a hidden id.
 */

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createDistrict,
  updateDistrict,
  type DistrictFormState,
} from "@/lib/actions/districts";
import { isValidHexColor } from "@/lib/district-branding.types";

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
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: DistrictInitial;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createDistrict : updateDistrict,
    initialState
  );

  return (
    <form action={action} className="space-y-6">
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      {mode === "edit" && initial && (
        <input type="hidden" name="district_id" value={initial.id} />
      )}

      {/* ── District details ──────────────────────────────────────── */}
      <Section title="District details">
        <Field label="District name" htmlFor="name" error={state.fieldErrors?.name}>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={255}
            defaultValue={initial?.name ?? ""}
            placeholder="e.g., Los Angeles County Office of Education"
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
            <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
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
      </Section>

      {/* ── Branding ──────────────────────────────────────────────── */}
      <Section title="Branding">
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
      </Section>

      {/* ── Points of contact ─────────────────────────────────────── */}
      <Section
        title="Points of contact"
        description={
          mode === "create"
            ? "Both required — each becomes a district admin you can invite."
            : "Edit contact details, or add a contact if one is missing."
        }
      >
        <PocBox
          prefix="primary"
          label="Primary contact"
          accent
          required={mode === "create"}
          initial={initial?.primaryPoc}
          state={state}
        />
        <PocBox
          prefix="secondary"
          label="Secondary contact"
          required={mode === "create"}
          initial={initial?.secondaryPoc}
          state={state}
        />
      </Section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="-mx-6 flex items-center justify-between gap-3 border-t border-gray-100 px-6 pt-4">
        {mode === "edit" ? (
          <ActiveToggle defaultChecked={initial?.active ?? true} />
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex shrink-0 items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {mode === "create" ? "Create district" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Sections & fields ────────────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

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

function PocBox({
  prefix,
  label,
  accent = false,
  required,
  initial,
  state,
}: {
  prefix: "primary" | "secondary";
  label: string;
  accent?: boolean;
  required: boolean;
  initial?: PocInitial;
  state: DistrictFormState;
}) {
  const fe = state.fieldErrors;
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          accent ? "text-rose-600" : "text-gray-500"
        }`}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <PocInput
          prefix={prefix}
          field="first_name"
          ariaLabel={`${label} first name`}
          placeholder="First name"
          required={required}
          maxLength={100}
          defaultValue={initial?.first_name ?? ""}
          error={fe?.[`${prefix}_poc_first_name`]}
        />
        <PocInput
          prefix={prefix}
          field="last_name"
          ariaLabel={`${label} last name`}
          placeholder="Last name"
          required={required}
          maxLength={100}
          defaultValue={initial?.last_name ?? ""}
          error={fe?.[`${prefix}_poc_last_name`]}
        />
      </div>
      <PocInput
        prefix={prefix}
        field="email"
        type="email"
        ariaLabel={`${label} email`}
        placeholder="name@district.org"
        required={required}
        maxLength={255}
        defaultValue={initial?.email ?? ""}
        error={fe?.[`${prefix}_poc_email`]}
      />
      <PocInput
        prefix={prefix}
        field="phone"
        type="tel"
        ariaLabel={`${label} phone`}
        placeholder="(555) 123-4567"
        required={required}
        maxLength={32}
        defaultValue={initial?.phone ?? ""}
        error={fe?.[`${prefix}_poc_phone`]}
      />
    </div>
  );
}

function PocInput({
  prefix,
  field,
  type = "text",
  ariaLabel,
  placeholder,
  required,
  maxLength,
  defaultValue,
  error,
}: {
  prefix: "primary" | "secondary";
  field: string;
  type?: string;
  ariaLabel: string;
  placeholder: string;
  required: boolean;
  maxLength: number;
  defaultValue: string;
  error?: string;
}) {
  const id = `${prefix}_poc_${field}`;
  return (
    <div>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-describedby={error ? `err-${id}` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`err-${id}`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ActiveToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        name="active"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-500"
        aria-hidden="true"
      />
      <span className="text-gray-600">
        <span className="font-medium text-gray-900">Active</span> — inactive
        districts can&apos;t be used to sign in
      </span>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500";

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
      <div className="mb-1.5 flex items-baseline justify-between">
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
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      )}
      <p>{children}</p>
    </div>
  );
}
