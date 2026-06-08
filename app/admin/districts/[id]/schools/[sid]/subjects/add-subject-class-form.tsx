"use client";

/**
 * Combined "Add a subject & class" form. One submit creates the whole chain:
 * subject (find-or-create) -> class -> period -> optional teacher. Lives only
 * on the subjects list; the subject-edit screen still uses SubjectForm.
 */

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createSubjectClass,
  type SubjectClassFormState,
} from "@/lib/actions/subject-class";

const initialState: SubjectClassFormState = {};

export type TeacherOption = { id: string; name: string };

export function AddSubjectClassForm({
  schoolId,
  teachers,
}: {
  schoolId: string;
  teachers: readonly TeacherOption[];
}) {
  const [state, action, pending] = useActionState(
    createSubjectClass,
    initialState
  );

  return (
    <form
      action={action}
      className="space-y-3 bg-white border border-gray-200 rounded-lg p-5"
    >
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      <input type="hidden" name="school_id" value={schoolId} />

      <div>
        <label htmlFor="subject_name" className={labelClass}>
          Subject
        </label>
        <input
          id="subject_name"
          name="subject_name"
          type="text"
          required
          maxLength={255}
          placeholder="e.g. English"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          Reused if it already exists at this school, otherwise created.
        </p>
        {state.fieldErrors?.subject_name && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.subject_name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="class_name" className={labelClass}>
          Class
        </label>
        <input
          id="class_name"
          name="class_name"
          type="text"
          required
          maxLength={255}
          placeholder="e.g. American Literature"
          className={inputClass}
        />
        {state.fieldErrors?.class_name && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.class_name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="period_label" className={labelClass}>
          Period / block
        </label>
        <input
          id="period_label"
          name="period_label"
          type="text"
          required
          maxLength={50}
          placeholder="e.g. Block 3"
          className={inputClass}
        />
        {state.fieldErrors?.period_label && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.period_label}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="teacher_id" className={labelClass}>
          Teacher <span className="text-gray-400">(optional)</span>
        </label>
        <select
          id="teacher_id"
          name="teacher_id"
          defaultValue=""
          className={inputClass}
        >
          <option value="">— unassigned —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {teachers.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            No teachers at this school yet — add one on the school page.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        Add subject & class
      </button>
    </form>
  );
}

const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

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
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <p>{children}</p>
    </div>
  );
}
