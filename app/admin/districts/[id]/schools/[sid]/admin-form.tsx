"use client";

/**
 * Add-school-admin form. On success it surfaces the one-time temp password
 * (shown once — the server doesn't store it), with a copy button.
 */

import { useActionState } from "react";
import { AlertCircle, Copy, KeyRound, Loader2 } from "lucide-react";
import {
  createSchoolAdmin,
  type SchoolAdminFormState,
} from "@/lib/actions/school-admins";

const initialState: SchoolAdminFormState = {};

export function AddSchoolAdminForm({ schoolId }: { schoolId: string }) {
  const [state, action, pending] = useActionState(
    createSchoolAdmin,
    initialState
  );

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && (
        <div
          role="alert"
          className="rounded-md p-3 flex items-start gap-2 border text-sm bg-red-50 border-red-200 text-red-700"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {state.success && (
        <Credentials
          email={state.success.email}
          password={state.success.password}
        />
      )}

      <input type="hidden" name="school_id" value={schoolId} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1.5">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            className={inputClass}
          />
          {state.fieldErrors?.first_name && (
            <p className="mt-1 text-sm text-red-600">
              {state.fieldErrors.first_name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            className={inputClass}
          />
          {state.fieldErrors?.last_name && (
            <p className="mt-1 text-sm text-red-600">
              {state.fieldErrors.last_name}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputClass}
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        Add admin
      </button>
    </form>
  );
}

function Credentials({ email, password }: { email: string; password: string }) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
      <div className="flex items-center gap-2 text-green-800 font-medium">
        <KeyRound className="w-4 h-4" />
        Admin created — share these credentials now (shown once)
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
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
