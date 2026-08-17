"use client";

/**
 * Add-student modal for the school Students page. Creates a student at the
 * admin's own school (createStudentAtSchool) with optional grade + student ID,
 * and surfaces the one-time temp password. The student starts unenrolled.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, KeyRound, Loader2, X } from "lucide-react";
import { createStudentAtSchool } from "@/lib/actions/school-users";
import type { ScopedUserFormState } from "@/lib/scoped-users";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";

const initialState: ScopedUserFormState = {};

export function AddStudentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createStudentAtSchool,
    initialState
  );
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "add-student-title";

  const close = () => {
    if (state.success) router.refresh();
    onClose();
  };

  // Focus trap, Escape-to-close, initial + restored focus (WCAG 2.1.2/2.4.3).
  useDialogA11y({
    isOpen: true,
    onClose: close,
    panelRef,
    initialFocusRef: firstFieldRef,
    locked: pending,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-gray-900">
            Add Student
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {state.success ? (
          <SuccessPanel
            email={state.success.email}
            password={state.success.password}
            onDone={close}
          />
        ) : (
          <form action={action} className="space-y-3.5 px-5 py-5">
            {state.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{state.error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="first_name" error={state.fieldErrors?.first_name}>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  maxLength={255}
                  ref={firstFieldRef}
                  className={inputClass}
                />
              </Field>
              <Field label="Last name" htmlFor="last_name" error={state.fieldErrors?.last_name}>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  maxLength={255}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
                placeholder="name@student.edu"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Grade" htmlFor="grade_level" optional>
                <input
                  id="grade_level"
                  name="grade_level"
                  type="text"
                  maxLength={20}
                  placeholder="e.g., 10"
                  className={inputClass}
                />
              </Labeled>
              <Labeled label="Student ID" htmlFor="student_id_external" optional>
                <input
                  id="student_id_external"
                  name="student_id_external"
                  type="text"
                  maxLength={50}
                  placeholder="e.g., S-20481"
                  className={inputClass}
                />
              </Labeled>
            </div>

            <p className="text-xs text-gray-500">
              A one-time temporary password is generated and shown once after
              creation. Enroll the student in classes from a period page.
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Add Student
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessPanel({
  email,
  password,
  onDone,
}: {
  email: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4 px-5 py-5">
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Added <span className="font-semibold">{email}</span>. Share the
          temporary password below — it won’t be shown again.
        </p>
      </div>
      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          Temporary password
        </span>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900">
            {password}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(password).then(
                () => setCopied(true),
                () => setCopied(false)
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Labeled({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {optional && <span className="ml-1 text-gray-500">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
