"use client";

/**
 * Shared authoring form for exemplars (chunk 6.1).
 *
 * Used by /dashboard/exemplars/new (create) and
 * /dashboard/exemplars/[id] (edit). The parent passes the appropriate
 * server action via the `action` prop. useActionState wires
 * ExemplarFormState back into field/banner error display.
 *
 * Char count is computed client-side and reflects the same 20,000-char
 * cap the server action enforces. Over-limit just disables the submit
 * button as a UX hint; final validation is server-side.
 */

import { useActionState, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import type { ExemplarFormState } from "@/lib/actions/exemplars";
import { EXEMPLAR_TEXT_MAX } from "@/lib/exemplar-limits";
import type { ExemplarForViewer } from "@/lib/queries/exemplars";

type Mode = "expository" | "argumentation" | "literary" | "narrative";

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "expository", label: "Expository" },
  { value: "argumentation", label: "Argumentation" },
  { value: "literary", label: "Literary" },
  { value: "narrative", label: "Narrative" },
];

const initialState: ExemplarFormState = {};

interface PrefillFromWriting {
  studentName: string;
  assignmentTitle: string;
  fullText: string;
  mode: Mode;
}

interface Props {
  action: (
    prev: ExemplarFormState,
    formData: FormData
  ) => Promise<ExemplarFormState>;
  initial?: ExemplarForViewer | null;
  formMode: "create" | "edit";
  /** Shown briefly after a successful save in edit mode. */
  savedNotice?: boolean;
  /** Promote-to-exemplar pre-fill (chunk 6.4). When set, the
   * student-permission banner renders above the title and the
   * full_text textarea starts populated with the writing's final
   * draft. */
  prefillFromWriting?: PrefillFromWriting;
}

export function ExemplarForm({
  action,
  initial,
  formMode,
  savedNotice,
  prefillFromWriting,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [text, setText] = useState<string>(
    initial?.full_text ?? prefillFromWriting?.fullText ?? ""
  );

  const charCount = text.length;
  const wordCount =
    text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const overLimit = charCount > EXEMPLAR_TEXT_MAX;

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      {savedNotice && !state.error && (
        <div
          className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2"
          role="status"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">Exemplar saved.</p>
        </div>
      )}

      {prefillFromWriting && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2"
          role="status"
        >
          <Sparkles className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p>
              Promoting from{" "}
              <span className="font-semibold">
                {prefillFromWriting.studentName}
              </span>
              &apos;s submission to{" "}
              <span className="font-semibold">
                {prefillFromWriting.assignmentTitle}
              </span>
              . Make sure you have permission from the student before
              publishing or sharing this exemplar.
            </p>
            <p className="mt-1 text-amber-800/90">
              If your draft is over 20,000 characters, trim before saving.
            </p>
          </div>
        </div>
      )}

      <Field
        id="title"
        label="Title"
        required
        error={state.fieldErrors?.title}
      >
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={initial?.title ?? ""}
          maxLength={255}
          placeholder="e.g. Sample Expository — Sports & Teamwork"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </Field>

      <Field id="description" label="Description (optional)">
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={initial?.description ?? ""}
          maxLength={500}
          placeholder="What does this exemplar demonstrate?"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </Field>

      <Field id="mode" label="Mode" required error={state.fieldErrors?.mode}>
        <select
          id="mode"
          name="mode"
          required
          defaultValue={
            initial?.mode ?? prefillFromWriting?.mode ?? "expository"
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="full_text"
        label="Exemplar text"
        required
        error={state.fieldErrors?.full_text}
        hint={
          <span
            className={
              overLimit ? "text-red-700 font-medium" : "text-gray-500"
            }
          >
            {wordCount.toLocaleString()} word{wordCount === 1 ? "" : "s"}{" "}
            · {charCount.toLocaleString()} / {EXEMPLAR_TEXT_MAX.toLocaleString()}{" "}
            chars
          </span>
        }
      >
        <textarea
          id="full_text"
          name="full_text"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Paste or type the exemplar essay/paragraph here."
        />
      </Field>

      <label className="inline-flex items-start gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={initial?.is_published ?? false}
          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="font-medium">Published</span> — students in your
          class periods see this exemplar. Students see the latest saved
          version.
        </span>
      </label>

      <label className="inline-flex items-start gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          name="shared_with_school"
          defaultChecked={initial?.shared_with_school ?? false}
          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="font-medium">Share with school</span> — other
          teachers at your school can view and pin this exemplar to their
          own assignments. Your students see it only when you publish.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || overLimit}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending
            ? "Saving…"
            : formMode === "create"
              ? "Create exemplar"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-800">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
