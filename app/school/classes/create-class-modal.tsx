"use client";

/**
 * Create-class modal for the school Classes page. The school is fixed (the
 * admin's own), so there's no school picker — just subject (find-or-create),
 * class, description, and period, via the shared createSubjectClass action.
 * Teachers/students are assigned later from the period page.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  createSubjectClass,
  type SubjectClassFormState,
} from "@/lib/actions/subject-class";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";

const initialState: SubjectClassFormState = {};
const ADD_SUBJECT = "__add__";

export function CreateClassModal({
  schoolId,
  subjects,
  onClose,
}: {
  schoolId: string;
  /** Existing subject names at the school, for the dropdown. */
  subjects: readonly string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createSubjectClass,
    initialState
  );
  // Subject comes from the dropdown; "Add subject…" reveals a text field.
  const [subjectChoice, setSubjectChoice] = useState(
    subjects.length > 0 ? "" : ADD_SUBJECT
  );
  const [newSubject, setNewSubject] = useState("");
  const subjectName =
    subjectChoice === ADD_SUBJECT ? newSubject : subjectChoice;
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "school-create-class-title";

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  // Focus trap, Escape-to-close, initial + restored focus (WCAG 2.1.2/2.4.3).
  useDialogA11y({
    isOpen: true,
    onClose,
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
        if (e.target === e.currentTarget) onClose();
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
            Create Class
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form action={action} className="space-y-3.5 px-5 py-5">
          <input type="hidden" name="school_id" value={schoolId} />

          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          <Field
            label="Subject"
            htmlFor="subject_choice"
            error={state.fieldErrors?.subject_name}
          >
            {/* The resolved subject name (existing or newly typed) is submitted. */}
            <input type="hidden" name="subject_name" value={subjectName} />
            <select
              id="subject_choice"
              value={subjectChoice}
              onChange={(e) => setSubjectChoice(e.target.value)}
              ref={firstFieldRef}
              className={inputClass}
            >
              {subjects.length > 0 && <option value="">— select a subject —</option>}
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={ADD_SUBJECT}>+ Add subject…</option>
            </select>

            {subjectChoice === ADD_SUBJECT && (
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                maxLength={255}
                placeholder="New subject name (e.g., Language Arts)"
                aria-label="New subject name"
                autoFocus
                className={`${inputClass} mt-2`}
              />
            )}
          </Field>

          <Field
            label="Class"
            htmlFor="class_name"
            error={state.fieldErrors?.class_name}
          >
            <input
              id="class_name"
              name="class_name"
              type="text"
              required
              maxLength={255}
              placeholder="e.g., AP English"
              className={inputClass}
            />
          </Field>

          <Field label="Description" htmlFor="description" optional>
            <textarea id="description" name="description" rows={2} className={inputClass} />
          </Field>

          <Field
            label="Period / block"
            htmlFor="period_label"
            error={state.fieldErrors?.period_label}
          >
            <input
              id="period_label"
              name="period_label"
              type="text"
              required
              maxLength={50}
              placeholder="e.g., Period 1"
              className={inputClass}
            />
          </Field>

          <p className="text-xs text-gray-500">
            Assign teachers and students from the period page after it’s created.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !subjectName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Create Class
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-400 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";

function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
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
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
