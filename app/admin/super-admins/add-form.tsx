"use client";

/**
 * Create-a-super-admin form. The acting admin sets a temporary password and
 * shares it out-of-band; the new admin changes it after first login. Mirrors
 * the useActionState + inline-error pattern from the signup decision form.
 */

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import {
  createSuperAdmin,
  type CreateSuperAdminState,
} from "@/lib/actions/super-admins";

const initialState: CreateSuperAdminState = {};

/** Generate a strong, copy-pasteable temporary password. */
function generatePassword(): string {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const length = 16;
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

export function AddSuperAdminForm() {
  const [state, formAction, pending] = useActionState(
    createSuperAdmin,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  if (state.success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3 text-sm text-green-800">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <p>
            Super admin <strong>{state.success.email}</strong> created. Share the
            temporary password securely; they should change it after first login.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-green-700 hover:text-green-900 underline"
        >
          Add another
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 max-w-xl"
    >
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="first_name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          />
          {state.fieldErrors?.first_name && (
            <p className="mt-1 text-sm text-red-600">
              {state.fieldErrors.first_name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="last_name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          />
          {state.fieldErrors?.last_name && (
            <p className="mt-1 text-sm text-red-600">
              {state.fieldErrors.last_name}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Temporary password
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-gray-900 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setPassword(generatePassword());
              setShowPassword(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Generate
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          At least 10 characters. Share it securely; they change it after first
          login.
        </p>
        {state.fieldErrors?.password && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating…
          </>
        ) : (
          "Create super admin"
        )}
      </button>
    </form>
  );
}
