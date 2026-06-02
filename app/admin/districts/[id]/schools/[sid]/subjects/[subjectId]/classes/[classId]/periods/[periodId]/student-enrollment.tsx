"use client";

/**
 * Student enrollment for a class period: the enrolled list (each with Remove)
 * + an "add & enroll a student" form. New accounts surface a one-time temp
 * password; an existing student is simply enrolled.
 */

import { useActionState } from "react";
import { AlertCircle, Copy, KeyRound, Loader2, X } from "lucide-react";
import {
  createAndEnrollStudent,
  unenrollStudent,
  type EnrollFormState,
  type UnenrollState,
} from "@/lib/actions/enrollments";
import type { EnrolledStudent } from "@/lib/queries/period-students";

const enrollInitial: EnrollFormState = {};
const unenrollInitial: UnenrollState = {};

export function StudentEnrollment({
  periodId,
  enrolled,
}: {
  periodId: string;
  enrolled: readonly EnrolledStudent[];
}) {
  const [enrollS, enrollA, enrolling] = useActionState(
    createAndEnrollStudent,
    enrollInitial
  );
  const [removeS, removeA] = useActionState(unenrollStudent, unenrollInitial);

  const name = (s: EnrolledStudent) =>
    [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "—";

  return (
    <div className="space-y-3">
      {removeS.error && (
        <p className="text-sm text-red-600" role="alert">
          {removeS.error}
        </p>
      )}

      <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg">
        {enrolled.map((s) => (
          <li
            key={s.student_id}
            className="flex items-center justify-between px-4 py-2"
          >
            <span className="text-sm text-gray-900">
              {name(s)}
              {s.grade_level && (
                <span className="ml-2 text-xs text-gray-500">
                  grade {s.grade_level}
                </span>
              )}
              {s.email && (
                <span className="ml-2 text-xs text-gray-400">{s.email}</span>
              )}
            </span>
            <form action={removeA}>
              <input type="hidden" name="period_id" value={periodId} />
              <input type="hidden" name="student_id" value={s.student_id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </button>
            </form>
          </li>
        ))}
        {enrolled.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">
            No students enrolled yet.
          </li>
        )}
      </ul>

      <form
        action={enrollA}
        className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
      >
        {enrollS.error && (
          <div
            role="alert"
            className="rounded-md p-3 flex items-start gap-2 border text-sm bg-red-50 border-red-200 text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{enrollS.error}</p>
          </div>
        )}
        {enrollS.success && (
          <Result
            email={enrollS.success.email}
            password={enrollS.success.password}
          />
        )}

        <input type="hidden" name="period_id" value={periodId} />

        <div className="grid grid-cols-2 gap-3">
          <Input name="first_name" label="First name" error={enrollS.fieldErrors?.first_name} />
          <Input name="last_name" label="Last name" error={enrollS.fieldErrors?.last_name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input name="email" label="Email" type="email" error={enrollS.fieldErrors?.email} />
          <Input name="grade_level" label="Grade (optional)" required={false} />
        </div>

        <button
          type="submit"
          disabled={enrolling}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
          Add &amp; enroll
        </button>
      </form>
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
  required = true,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Result({ email, password }: { email: string; password?: string }) {
  if (!password) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Enrolled <span className="font-medium">{email}</span>.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
      <div className="flex items-center gap-2 text-green-800 font-medium">
        <KeyRound className="w-4 h-4" />
        Student created &amp; enrolled — share these now (shown once)
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
