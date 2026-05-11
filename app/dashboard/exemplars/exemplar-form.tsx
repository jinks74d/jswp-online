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

import { useActionState, useRef, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import type { ExemplarFormState } from "@/lib/actions/exemplars";
import {
  EXEMPLAR_TEXT_MAX,
  STEP_TAG_VALUES,
  STEP_TAG_LABELS,
  type StepTag,
} from "@/lib/exemplar-limits";
import { htmlToPlainText } from "@/lib/exemplar-content-shared";
import type { ExemplarForViewer } from "@/lib/queries/exemplars";
import { ColorToolbar } from "@/components/dashboard/exemplars/color-toolbar";
import { ExemplarRender } from "@/components/exemplar-render";

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
  const [contentFormat, setContentFormat] = useState<"plain" | "html">(
    initial?.content_format ?? "plain"
  );
  const [mode, setMode] = useState<Mode>(
    initial?.mode ?? prefillFromWriting?.mode ?? "expository"
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialTags = (initial?.step_tags ?? []).filter((t): t is StepTag =>
    (STEP_TAG_VALUES as readonly string[]).includes(t)
  );
  const [stepTags, setStepTags] = useState<Set<StepTag>>(
    () => new Set(initialTags)
  );

  /** Handle the radio toggle. plain → html is free; html → plain
   * strips marks after confirmation when marks exist. */
  const onFormatChange = (next: "plain" | "html") => {
    if (next === contentFormat) return;
    if (next === "plain") {
      const hasMarks = /<span\s+class="jswp-[\w-]+">/.test(text);
      if (hasMarks) {
        const ok = window.confirm(
          "Switching to plain text will remove all color tags from this exemplar. Continue?"
        );
        if (!ok) return;
        // Strip jswp-* span wrappers (keep inner text). Other allowed
        // tags (p, br, em, strong) stay; downstream the action layer
        // treats the format as 'plain' and stores text as-is.
        const stripped = text.replace(
          /<span\s+class="jswp-[\w-]+">([^<]*)<\/span>/g,
          "$1"
        );
        setText(stripped);
      }
    }
    setContentFormat(next);
  };

  const toggleTag = (tag: StepTag) => {
    setStepTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // Char count uses raw text length (matches the server-side cap on
  // saved markup). Word count strips tags for an accurate count in
  // html mode so teachers see what students will read.
  const charCount = text.length;
  const wordCountSource =
    contentFormat === "html" ? htmlToPlainText(text) : text;
  const wordCount =
    wordCountSource.trim().length === 0
      ? 0
      : wordCountSource.trim().split(/\s+/).length;
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
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-800 mb-1">
          Content format
        </legend>
        <div className="flex flex-wrap gap-3 text-sm text-gray-800">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name="content_format"
              value="plain"
              checked={contentFormat === "plain"}
              onChange={() => onFormatChange("plain")}
              className="text-blue-600 focus:ring-blue-500"
            />
            Plain text
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name="content_format"
              value="html"
              checked={contentFormat === "html"}
              onChange={() => onFormatChange("html")}
              className="text-blue-600 focus:ring-blue-500"
            />
            HTML (JSWP color codes)
          </label>
        </div>
        {contentFormat === "html" && (
          <p className="mt-2 text-xs text-gray-600">
            Select text in the editor, then click a toolbar button to
            mark it. Character count includes markup. Invalid tags or
            classes are rejected at save time.
          </p>
        )}
      </fieldset>

      <Field
        id="full_text"
        label={contentFormat === "html" ? "Exemplar text (HTML)" : "Exemplar text"}
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
        {contentFormat === "html" && (
          <ColorToolbar
            textareaRef={textareaRef}
            value={text}
            onChange={setText}
            mode={mode}
          />
        )}
        <textarea
          id="full_text"
          name="full_text"
          required
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={
            contentFormat === "html"
              ? "Type the exemplar text, then select passages and click toolbar buttons to mark them."
              : "Paste or type the exemplar essay/paragraph here."
          }
        />
      </Field>

      {contentFormat === "html" && (
        <section
          aria-label="Exemplar preview"
          className="border border-gray-200 rounded-md bg-gray-50 p-3"
        >
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Preview
          </h3>
          {text.trim().length > 0 ? (
            <ExemplarRender
              content={text}
              format="html"
              className="text-sm text-gray-900"
            />
          ) : (
            <p className="text-sm text-gray-500 italic">
              Preview appears here once you start typing.
            </p>
          )}
        </section>
      )}

      <fieldset>
        <legend className="block text-sm font-medium text-gray-800 mb-1">
          Step tags{" "}
          <span className="font-normal text-gray-500">
            (optional — which JSWP steps does this exemplar illustrate?)
          </span>
        </legend>
        <p className="text-xs text-gray-600 mb-2">
          Students on a matching step see tagged exemplars first. Leave
          empty for "general" — appears as fallback on every step.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STEP_TAG_VALUES.map((tag) => {
            const selected = stepTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={selected}
                className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {STEP_TAG_LABELS[tag]}
              </button>
            );
          })}
        </div>
        {/* Hidden inputs serialize the Set into FormData. One entry
            per selected tag — server action reads via getAll(). */}
        {Array.from(stepTags).map((tag) => (
          <input key={tag} type="hidden" name="step_tags" value={tag} />
        ))}
        {state.fieldErrors?.step_tags && (
          <p className="mt-1 text-sm text-red-700">
            {state.fieldErrors.step_tags}
          </p>
        )}
      </fieldset>

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
