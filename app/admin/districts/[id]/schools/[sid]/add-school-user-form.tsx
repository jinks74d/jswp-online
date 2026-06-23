"use client";

/**
 * Generic "add a school-scoped user" form (admins + teachers). The server
 * action is passed in, so the same UI serves every role. On success it surfaces
 * the one-time temp password (shown once — the server doesn't store it).
 */

import { useActionState } from "react";
import { AlertCircle, Copy, KeyRound, Loader2 } from "lucide-react";
import type { ScopedUserFormState } from "@/lib/scoped-users";
import { ADMIN_KINDS, DEFAULT_ADMIN_KIND } from "@/lib/admin-kinds";

const initialState: ScopedUserFormState = {};

export function AddSchoolUserForm({
  schoolId,
  action,
  roleLabel,
  showAdminKind = false,
}: {
  schoolId: string;
  action: (
    prev: ScopedUserFormState,
    formData: FormData
  ) => Promise<ScopedUserFormState>;
  roleLabel: string;
  /** Show the Administrator / Counselor / Other selector (admins only). */
  showAdminKind?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && (
        <div
          role="alert"
          className="rounded-md p-3 flex items-start gap-2 border text-sm bg-red-50 border-red-200 text-red-700"
        >
          <AlertCircle
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <p>{state.error}</p>
        </div>
      )}

      {state.success && (
        <Credentials
          email={state.success.email}
          password={state.success.password}
          roleLabel={roleLabel}
        />
      )}

      <input type="hidden" name="school_id" value={schoolId} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`first_name_${roleLabel}`} className="block text-sm font-medium text-gray-700 mb-1.5">
            First name
          </label>
          <input
            id={`first_name_${roleLabel}`}
            name="first_name"
            type="text"
            required
            aria-invalid={!!state.fieldErrors?.first_name}
            aria-describedby={
              state.fieldErrors?.first_name
                ? `err-first_name_${roleLabel}`
                : undefined
            }
            className={inputClass}
          />
          {state.fieldErrors?.first_name && (
            <p
              id={`err-first_name_${roleLabel}`}
              className="mt-1 text-sm text-red-600"
            >
              {state.fieldErrors.first_name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`last_name_${roleLabel}`} className="block text-sm font-medium text-gray-700 mb-1.5">
            Last name
          </label>
          <input
            id={`last_name_${roleLabel}`}
            name="last_name"
            type="text"
            required
            aria-invalid={!!state.fieldErrors?.last_name}
            aria-describedby={
              state.fieldErrors?.last_name
                ? `err-last_name_${roleLabel}`
                : undefined
            }
            className={inputClass}
          />
          {state.fieldErrors?.last_name && (
            <p
              id={`err-last_name_${roleLabel}`}
              className="mt-1 text-sm text-red-600"
            >
              {state.fieldErrors.last_name}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`email_${roleLabel}`} className="block text-sm font-medium text-gray-700 mb-1.5">
          Email
        </label>
        <input
          id={`email_${roleLabel}`}
          name="email"
          type="email"
          required
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={
            state.fieldErrors?.email ? `err-email_${roleLabel}` : undefined
          }
          className={inputClass}
        />
        {state.fieldErrors?.email && (
          <p id={`err-email_${roleLabel}`} className="mt-1 text-sm text-red-600">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      {showAdminKind && (
        <div>
          <label
            htmlFor={`admin_kind_${roleLabel}`}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Role
          </label>
          <select
            id={`admin_kind_${roleLabel}`}
            name="admin_kind"
            defaultValue={DEFAULT_ADMIN_KIND}
            aria-describedby={`hint-admin_kind_${roleLabel}`}
            className={inputClass}
          >
            {ADMIN_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p
            id={`hint-admin_kind_${roleLabel}`}
            className="mt-1 text-xs text-gray-500"
          >
            Determines which dashboard this admin sees.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        Add {roleLabel}
      </button>
    </form>
  );
}

function Credentials({
  email,
  password,
  roleLabel,
}: {
  email: string;
  password: string;
  roleLabel: string;
}) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
      <div className="flex items-center gap-2 text-green-800 font-medium">
        <KeyRound className="w-4 h-4" aria-hidden="true" />
        {roleLabel[0].toUpperCase() + roleLabel.slice(1)} created — share these
        now (shown once)
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded bg-white border border-green-200 px-2 py-1.5 font-mono text-xs">
        <span className="truncate">
          {email} · {password}
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(`${email} ${password}`)}
          className="inline-flex items-center gap-1 text-green-700 hover:text-green-900"
        >
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          Copy
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
