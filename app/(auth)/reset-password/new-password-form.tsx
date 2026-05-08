"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import {
  updatePasswordAction,
  type AuthFormState,
} from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export function NewPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Set a new password
        </h2>
        <p className="text-sm text-gray-600">
          Choose a password of 8 or more characters.
        </p>
      </div>

      {state.error && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <PasswordField
        id="password"
        name="password"
        label="New password"
        placeholder="Enter your new password"
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        error={state.fieldErrors?.password}
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        placeholder="Re-enter your new password"
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pending={isPending} />
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  placeholder,
  show,
  onToggle,
  error,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          placeholder={placeholder}
          aria-invalid={!!error}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="w-4 h-4 text-gray-400" />
          ) : (
            <Eye className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Updating...
        </span>
      ) : (
        "Update password"
      )}
    </button>
  );
}
