"use client";

/**
 * Shared school form — create (on the district detail page) and edit (on the
 * school detail page). Carries district_id so the action can scope the write.
 */

import { useState } from "react";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
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

  // Administrator rows (create only). Stable keys, not indices, so removing a
  // row doesn't make React reuse the wrong row's uncontrolled input values.
  const [adminKeys, setAdminKeys] = useState<number[]>([0]);
  const [nextAdminKey, setNextAdminKey] = useState(1);

  const addAdmin = () => {
    setAdminKeys((ks) => [...ks, nextAdminKey]);
    setNextAdminKey((k) => k + 1);
  };
  const removeAdmin = (key: number) =>
    setAdminKeys((ks) => (ks.length > 1 ? ks.filter((k) => k !== key) : ks));

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && (
        <Banner kind="error">{state.error}</Banner>
      )}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      {state.createdAdmins && state.createdAdmins.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            Temporary passwords — shown once
          </p>
          <p className="mt-1 text-amber-800">
            Copy these now. They cannot be retrieved later; after this, use a
            password reset.
          </p>
          <ul className="mt-2 space-y-1">
            {state.createdAdmins.map((a) => (
              <li
                key={a.email}
                className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-amber-900"
              >
                <span className="break-all">{a.email}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold">{a.password}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          placeholder="e.g., Keller High School"
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
            placeholder="e.g., Vocational Academy"
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
          placeholder="e.g., 800 N. White Chapel Blvd, Southlake, TX"
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

      {mode === "create" && (
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-900">
            School administrators
          </legend>
          <p className="mb-3 text-xs text-gray-600">
            At least one is required. Each gets a school-admin account and a
            one-time password shown after the school is created.
          </p>

          {state.adminFormError && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {state.adminFormError}
            </p>
          )}

          <div className="space-y-3">
            {adminKeys.map((key, i) => (
              <AdminRow
                key={key}
                index={i}
                canRemove={adminKeys.length > 1}
                onRemove={() => removeAdmin(key)}
                errors={state.adminErrors?.[i]}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addAdmin}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another administrator
          </button>
        </fieldset>
      )}

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
            className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brand)]"
            aria-hidden="true"
          />
          <span className="font-medium text-gray-900">Active</span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-contrast)] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-50"
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
  "w-full rounded-md border border-gray-400 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";

/**
 * One administrator's fields. Inputs use repeated (un-indexed) names so the
 * server can zip them with FormData.getAll() in DOM order — see
 * lib/school-admins.ts. Ids are index-suffixed only to keep labels unique.
 */
function AdminRow({
  index,
  canRemove,
  onRemove,
  errors,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  errors?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}) {
  const uid = (field: string) => `admin-${field}-${index}`;
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Administrator {index + 1}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded p-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
            <span className="sr-only"> administrator {index + 1}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AdminField
          id={uid("first")}
          name="admin_first_name"
          label="First name"
          autoComplete="off"
          error={errors?.first_name}
        />
        <AdminField
          id={uid("last")}
          name="admin_last_name"
          label="Last name"
          autoComplete="off"
          error={errors?.last_name}
        />
        <AdminField
          id={uid("email")}
          name="admin_email"
          label="Email"
          type="email"
          placeholder="admin@school.org"
          autoComplete="off"
          error={errors?.email}
        />
        <AdminField
          id={uid("phone")}
          name="admin_phone"
          label="Phone"
          type="tel"
          placeholder="(555) 201-8890"
          autoComplete="off"
          error={errors?.phone}
        />
      </div>
    </div>
  );
}

function AdminField({
  id,
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `err-${id}` : undefined}
        className={`${inputClass} py-1.5 text-sm`}
      />
      {error && (
        <p id={`err-${id}`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
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
