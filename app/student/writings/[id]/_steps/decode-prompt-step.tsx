"use client";

/**
 * Decode-the-Prompt step UI. Six fields mirroring prompt_decodings:
 *   task               (textarea)
 *   form               (select: short_answer | paragraph | essay)
 *   ratio_identified   (select: 2+:1 | 1:2+ | 3+:0)
 *   key_verbs          (comma-separated input → string[])
 *   focus_terms        (comma-separated input → string[])
 *   notes              (textarea)
 *
 * Save behavior:
 *   * Each field's onBlur fires savePromptDecoding with the FULL form
 *     payload (server upserts). Fire-and-forget; failures log to console.
 *   * [Continue] calls completePromptDecoding which saves, marks the step
 *     complete, then server-redirects to the next step.
 *   * [Continue] is gated client-side on a non-empty trimmed task. Server
 *     re-validates as a defense in depth.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  savePromptDecoding,
  completePromptDecoding,
  type PromptDecodingFields,
} from "@/lib/actions/prompt-decoding";
import { useWritingMode } from "@/components/student/writing/use-writing-mode";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

const RATIO_LABELS: Record<ChunkRatio, string> = {
  lit_one_to_two_plus: "•	Literary, style, and rhetorical analysis (1:2+)",
  lit_three_plus_to_zero: "•	Literary plot summary (3+:0)",
  nar_two_plus_to_one: "•	Personal and fictional narrative (2+:1)",
  nonlit_summary_three_plus_to_zero: "•	Nonliterary summary (3+:0)",
  nonlit_expository_two_plus_to_one: "•	Nonliterary expository (2+:1)",
  nonlit_argumentation_two_plus_to_one: "•	Nonliterary argumentation (2+:1)",
};

const FORM_LABELS: Record<string, string> = {
  short_answer: "•	Short answer/response",
  paragraph: "•	Single paragraph (body, intro, or conclusion)",
  essay: "•	Multi-paragraph essay",
  research: "•	Research project",
};

interface InitialFields {
  background_text: string;
  trigger_text: string;
  cd_source: string;
  task: string;
  form: string;
  ratio_identified: string;
  key_verbs: readonly string[];
  focus_terms: readonly string[];
  notes: string;
}

interface FormState {
  background_text: string;
  trigger_text: string;
  cd_source: string;
  task: string;
  form: string;
  ratio_identified: string;
  key_verbs: string; // raw comma-separated input
  focus_terms: string; // raw comma-separated input
  notes: string;
}

function initialToState(init: InitialFields): FormState {
  return {
    background_text: init.background_text,
    trigger_text: init.trigger_text,
    cd_source: init.cd_source,
    task: init.task,
    form: init.form,
    ratio_identified: init.ratio_identified,
    key_verbs: init.key_verbs.join(", "),
    focus_terms: init.focus_terms.join(", "),
    notes: init.notes,
  };
}

function stateToFields(s: FormState): PromptDecodingFields {
  return {
    background_text: s.background_text || null,
    trigger_text: s.trigger_text || null,
    cd_source: s.cd_source || null,
    task: s.task || null,
    form: s.form || null,
    ratio_identified: (s.ratio_identified as ChunkRatio) || null,
    key_verbs: s.key_verbs
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    focus_terms: s.focus_terms
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    notes: s.notes || null,
  };
}

export function DecodePromptStep({
  writingId,
  assignmentPrompt,
  stepLabel,
  pedagogyHint,
  initial,
}: {
  writingId: string;
  assignmentPrompt: string;
  stepLabel: string;
  pedagogyHint: string | null;
  initial: InitialFields;
}) {
  const { isReadOnly } = useWritingMode();
  const [form, setForm] = useState<FormState>(initialToState(initial));
  const [savedFlash, setSavedFlash] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [isContinuing, startContinue] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const update =
    <K extends keyof FormState>(key: K) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleBlur = async () => {
    setSavedFlash("saving");
    try {
      await savePromptDecoding(writingId, stateToFields(form));
      setSavedFlash("saved");
      setTimeout(() => setSavedFlash("idle"), 1500);
    } catch (e) {
      console.error("Auto-save failed:", e);
      setSavedFlash("idle");
    }
  };

  const canContinue = form.task.trim().length > 0;

  const handleContinue = () => {
    setError(null);
    startContinue(async () => {
      try {
        await completePromptDecoding(writingId, stateToFields(form));
        // completePromptDecoding redirects on success; if it returns,
        // something went wrong silently.
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not continue.";
        // Next.js redirects throw — let those propagate.
        if (msg === "NEXT_REDIRECT") return;
        setError(msg);
      }
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Decode the Prompt
        </h2>
        {pedagogyHint && (
          <p className="mt-1 text-sm text-gray-600">{pedagogyHint}</p>
        )}
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          The prompt
        </div>
        <p className="text-gray-800 whitespace-pre-wrap">{assignmentPrompt}</p>
      </section>

      {/* Break the prompt into its parts (Background → Trigger → Task) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Break the prompt into its parts
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            <strong>EFFECTIVE PROMPTS</strong> have three distinctive parts: 1)
            a Background Sentence or Sentences; 2) a Trigger Sentence; and 3)
            the Task.
          </p>
        </div>

        {/* background */}
        <Field
          label="Background"
          help="The beginning sentence or sentences are designed to introduce the topic of the writing assignment and to START MY THINKING."
        ></Field>

        {/* trigger */}
        <Field
          label="Trigger"
          help="Typically, this sentence focuses my attention on a source or sources that alert me to where I will GATHER MY CDS: a text or video, class notes, an event or experience, a concept I’m studying, a statement made by someone.  "
        >
          <textarea
            rows={2}
            value={form.trigger_text}
            onChange={update("trigger_text")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            placeholder="My concrete detail will come from…"
          />
        </Field>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
        {/* task */}
        <Field
          label="What is the prompt asking you to DO?"
          help="What must I DO? Look for the word, “Write.”"
          required
        >
          <textarea
            rows={3}
            value={form.task}
            onChange={update("task")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            placeholder="Re-state the task verbatim."
          />
        </Field>

        {/* form */}
        <Field label="What FORMAT does the prompt expect?">
          <select
            value={form.form}
            onChange={update("form")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="">— Select —</option>
            {Object.entries(FORM_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {/* ratio */}
        <Field label="What CD-to-CM ratio fits this prompt?">
          <select
            value={form.ratio_identified}
            onChange={update("ratio_identified")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="">— Select —</option>
            {(Object.keys(RATIO_LABELS) as ChunkRatio[]).map((v) => (
              <option key={v} value={v}>
                {RATIO_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>

        {/* key verbs */}
        <Field
          label="Which VERB or VERBS in the prompt guide my thinking and imply what CD I am to find and/or CM I am to reveal to my reader?"
          help="Verbs that suggest CD: identify, list, define, categorize Verbs that suggest CM: discuss, analyze, interpret, argue
Verb that suggests both CD and CM: explain
"
        >
          <input
            type="text"
            value={form.key_verbs}
            onChange={update("key_verbs")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            placeholder="discuss, analyze"
          />
        </Field>

        {/* focus terms */}
        <Field
          label="WHO or WHAT am I writing about?"
          help="What is the topic of this paragraph or topic for this essay? Look for nouns or key concepts."
        >
          <input
            type="text"
            value={form.focus_terms}
            onChange={update("focus_terms")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            placeholder="steamboat, theme, photosynthesis"
          />
        </Field>

        {/* notes */}
        <Field
          label="Anything else to remember about the prompt?"
          help="Any other notes that will help you write a strong response."
        >
          <textarea
            rows={2}
            value={form.notes}
            onChange={update("notes")}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </Field>
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500" aria-live="polite">
            {savedFlash === "saving" && "Saving…"}
            {savedFlash === "saved" && "Saved"}
          </div>

          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue || isContinuing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {isContinuing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isContinuing ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-900">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </div>
      {help && <div className="mt-0.5 text-xs text-gray-500">{help}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
