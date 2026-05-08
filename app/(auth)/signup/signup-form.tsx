"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { signUpAction, type AuthFormState } from "@/lib/actions/auth";

export type SchoolOption = { id: string; name: string };

const initialState: AuthFormState = {};

export function SignupForm({ schools }: { schools: SchoolOption[] }) {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);

  if (state.success) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3"
        role="status"
      >
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-green-800">
            Check your email
          </h3>
          <p className="text-sm text-green-700 mt-1">{state.success}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Sign up failed
            </h3>
            <p className="text-sm text-red-700 mt-1">{state.error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="first_name"
          name="first_name"
          label="First name"
          type="text"
          autoComplete="given-name"
          placeholder="First"
        />
        <Field
          id="last_name"
          name="last_name"
          label="Last name"
          type="text"
          autoComplete="family-name"
          placeholder="Last"
        />
      </div>

      <Field
        id="email"
        name="email"
        label="Email Address"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        error={state.fieldErrors?.email}
      />

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          I&apos;m signing up as a…
        </legend>
        <div className="space-y-2">
          {(
            [
              ["teacher", "Teacher"],
              ["school_admin", "School administrator"],
              ["district_admin", "District administrator"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-gray-900"
            >
              <input
                type="radio"
                name="requested_role"
                value={value}
                defaultChecked={value === "teacher"}
                required
                className="text-blue-600 focus:ring-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {schools.length > 0 && (
        <div>
          <label
            htmlFor="requested_school_id"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            School (optional)
          </label>
          <select
            id="requested_school_id"
            name="requested_school_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            defaultValue=""
          >
            <option value="">— I&apos;m not sure —</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Anything we should know? (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="e.g. I teach 9th grade English at Lincoln HS"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="Create a password (8+ characters)"
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        error={state.fieldErrors?.password}
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm Password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pending={isPending} />
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  placeholder,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
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
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  show,
  onToggle,
  error,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
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
          autoComplete={autoComplete}
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
          Creating account...
        </span>
      ) : (
        "Create account"
      )}
    </button>
  );
}
