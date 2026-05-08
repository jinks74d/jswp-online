"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { requestResetAction, type AuthFormState } from "@/lib/actions/auth";

export function RequestForm({ initialError }: { initialError?: string }) {
  const initialState: AuthFormState = initialError
    ? { error: initialError }
    : {};
  const [state, formAction, isPending] = useActionState(
    requestResetAction,
    initialState
  );

  if (state.success) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3"
        role="status"
      >
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-green-800">Check your email</h3>
          <p className="text-sm text-green-700 mt-1">{state.success}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Forgot your password?
        </h2>
        <p className="text-sm text-gray-600">
          Enter your email and we&apos;ll send you a link to set a new one.
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

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={!!state.fieldErrors?.email}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          placeholder="Enter your email"
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
        )}
      </div>

      <SubmitButton pending={isPending} />
    </form>
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
          Sending...
        </span>
      ) : (
        "Send reset link"
      )}
    </button>
  );
}
