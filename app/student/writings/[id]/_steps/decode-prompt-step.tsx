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
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

const RATIO_LABELS: Record<ChunkRatio, string> = {
  two_plus_to_one: "2+:1 (CD : CM)",
  one_to_two_plus: "1:2+ (CD : CM)",
  three_plus_to_zero: "3+:0 (summary)",
};

const FORM_LABELS: Record<string, string> = {
  short_answer: "Short Answer",
  paragraph: "Paragraph",
  essay: "Essay",
};

interface InitialFields {
  task: string;
  form: string;
  ratio_identified: string;
  key_verbs: readonly string[];
  focus_terms: readonly string[];
  notes: string;
}

interface FormState {
  task: string;
  form: string;
  ratio_identified: string;
  key_verbs: string;       // raw comma-separated input
  focus_terms: string;     // raw comma-separated input
  notes: string;
}

function initialToState(init: InitialFields): FormState {
  return {
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
    task: s.task || null,
    form: s.form || null,
    ratio_identified:
      (s.ratio_identified as ChunkRatio) || null,
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
  const [form, setForm] = useState<FormState>(initialToState(initial));
  const [savedFlash, setSavedFlash] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [isContinuing, startContinue] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const update =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
        {/* task */}
        <Field
          label="What is the prompt asking you to DO?"
          help="Re-state the task in your own words. What's the verb, and what's it asking about?"
          required
        >
          <textarea
            rows={3}
            value={form.task}
            onChange={update("task")}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="The prompt is asking me to..."
          />
        </Field>

        {/* form */}
        <Field
          label="What form does the prompt expect?"
          help="A short answer, a single paragraph, or a full essay?"
        >
          <select
            value={form.form}
            onChange={update("form")}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Field
          label="What CD-to-CM ratio fits this prompt?"
          help="Most expository / argumentation / narrative prompts are 2+:1. Literary analysis is 1:2+. A summary is 3+:0."
        >
          <select
            value={form.ratio_identified}
            onChange={update("ratio_identified")}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          label="Which VERBS in the prompt tell you what kind of thinking to do?"
          help="Examples: discuss, argue, analyze, compare, describe, explain. Separate with commas."
        >
          <input
            type="text"
            value={form.key_verbs}
            onChange={update("key_verbs")}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="discuss, analyze"
          />
        </Field>

        {/* focus terms */}
        <Field
          label="What KEY TERMS does the prompt focus on?"
          help="The nouns or concepts the prompt is really about. Separate with commas."
        >
          <input
            type="text"
            value={form.focus_terms}
            onChange={update("focus_terms")}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="industrial revolution, child labor"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      </div>

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
  children: React.ReactNode;
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
