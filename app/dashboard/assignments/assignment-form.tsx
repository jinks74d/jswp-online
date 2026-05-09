"use client";

/**
 * Single shared assignment form, used by /new (mode picked from URL,
 * formMode="create") and /[id] (formMode="edit", initial values
 * pre-filled, possibly published).
 *
 * Conditional rendering:
 *   - is_essay always visible
 *   - num_body_paragraphs + default_chunks_per_bp visible only when is_essay
 *   - chunk_ratio: hidden for literary (locked to one_to_two_plus via hidden input)
 *   - has_counterargument: visible only for argumentation
 *
 * After publish, structural fields lock; only title/prompt/due_at/class_period_id stay editable.
 */

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  createDraftAssignment,
  updateDraftAssignment,
  publishAssignment,
  type AssignmentFormState,
} from "@/lib/actions/assignments";

type Mode = "expository" | "argumentation" | "literary" | "narrative";
type ChunkRatio = "two_plus_to_one" | "one_to_two_plus" | "three_plus_to_zero";

export type ClassPeriodOption = { id: string; label: string };

export type AssignmentInitial = {
  id: string;
  title: string;
  prompt: string;
  is_essay: boolean;
  num_body_paragraphs: number;
  default_chunk_ratio: ChunkRatio;
  default_chunks_per_bp: number;
  has_counterargument: boolean;
  due_at: string | null;
  class_period_id: string | null;
  released_at: string | null;
};

const initialState: AssignmentFormState = {};

export function AssignmentForm({
  formMode,
  mode,
  initial,
  classPeriods,
}: {
  formMode: "create" | "edit";
  mode: Mode;
  initial?: AssignmentInitial;
  classPeriods: ClassPeriodOption[];
}) {
  const isPublished = initial?.released_at != null;
  const isLiterary = mode === "literary";
  const isArgumentation = mode === "argumentation";

  const [isEssay, setIsEssay] = useState<boolean>(initial?.is_essay ?? false);
  const [numBP, setNumBP] = useState<number>(
    initial?.num_body_paragraphs ?? 3
  );
  const [chunksPerBP, setChunksPerBP] = useState<number>(
    initial?.default_chunks_per_bp ?? 1
  );
  const [chunkRatio, setChunkRatio] = useState<ChunkRatio>(
    initial?.default_chunk_ratio ??
      (isLiterary ? "one_to_two_plus" : "two_plus_to_one")
  );
  const [hasCounter, setHasCounter] = useState<boolean>(
    initial?.has_counterargument ?? false
  );

  const [createState, createAction, creating] = useActionState(
    createDraftAssignment,
    initialState
  );
  const [updateState, updateAction, updating] = useActionState(
    updateDraftAssignment,
    initialState
  );

  const state = formMode === "create" ? createState : updateState;
  const isPending = formMode === "create" ? creating : updating;

  // When toggling is_essay ON for the first time, bump num_body_paragraphs
  // to its minimum-for-essays (2) if the current value is 1.
  function handleIsEssayChange(next: boolean) {
    setIsEssay(next);
    if (next && numBP < 2) setNumBP(2);
  }

  return (
    <div className="space-y-6">
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}

      <form
        action={formMode === "create" ? createAction : updateAction}
        className="space-y-5 bg-white border border-gray-200 rounded-lg p-6"
      >
        <input type="hidden" name="mode" value={mode} />
        {initial && (
          <input type="hidden" name="assignment_id" value={initial.id} />
        )}
        {/* Literary-only chunk-ratio lock (CHECK constraint enforces it server-side too). */}
        {isLiterary && (
          <input
            type="hidden"
            name="default_chunk_ratio"
            value="one_to_two_plus"
          />
        )}

        <Field label="Title" htmlFor="title" error={state.fieldErrors?.title}>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={255}
            defaultValue={initial?.title ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Sports & Teamwork"
          />
        </Field>

        <Field
          label="Prompt"
          htmlFor="prompt"
          error={state.fieldErrors?.prompt}
        >
          <textarea
            id="prompt"
            name="prompt"
            required
            rows={5}
            maxLength={5000}
            defaultValue={initial?.prompt ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Write the question or task students will respond to."
          />
        </Field>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_essay"
              checked={isEssay}
              onChange={(e) => handleIsEssayChange(e.target.checked)}
              disabled={isPublished}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-900">Essay format</span>
            <span className="text-gray-600">
              (multiple body paragraphs)
            </span>
          </label>
        </div>

        {isEssay && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Body paragraphs"
              htmlFor="num_body_paragraphs"
              error={state.fieldErrors?.num_body_paragraphs}
              hint="2-10"
            >
              <input
                id="num_body_paragraphs"
                name="num_body_paragraphs"
                type="number"
                min={2}
                max={10}
                value={numBP}
                onChange={(e) => setNumBP(Number(e.target.value))}
                disabled={isPublished}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 disabled:bg-gray-50"
              />
            </Field>
            <Field
              label="Chunks per body paragraph"
              htmlFor="default_chunks_per_bp"
              error={state.fieldErrors?.default_chunks_per_bp}
              hint="1-5"
            >
              <input
                id="default_chunks_per_bp"
                name="default_chunks_per_bp"
                type="number"
                min={1}
                max={5}
                value={chunksPerBP}
                onChange={(e) => setChunksPerBP(Number(e.target.value))}
                disabled={isPublished}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 disabled:bg-gray-50"
              />
            </Field>
          </div>
        )}

        {!isLiterary && (
          <Field label="Chunk ratio" htmlFor="chunk_ratio">
            <select
              id="chunk_ratio"
              name="default_chunk_ratio"
              value={chunkRatio}
              onChange={(e) => setChunkRatio(e.target.value as ChunkRatio)}
              disabled={isPublished}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 disabled:bg-gray-50"
            >
              <option value="two_plus_to_one">
                2+:1 — multiple details, single commentary
              </option>
              <option value="one_to_two_plus">
                1:2+ — single detail, multiple commentary
              </option>
              <option value="three_plus_to_zero">
                3+:0 — summary (no commentary)
              </option>
            </select>
          </Field>
        )}

        {isLiterary && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
            Literary mode uses a fixed 1:2+ ratio (one detail with at least
            two commentary moves).
          </p>
        )}

        {isArgumentation && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="has_counterargument"
                checked={hasCounter}
                onChange={(e) => setHasCounter(e.target.checked)}
                disabled={isPublished}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-900">
                Include counterargument + refutation
              </span>
            </label>
          </div>
        )}

        <Field label="Due date (optional)" htmlFor="due_at">
          <input
            id="due_at"
            name="due_at"
            type="datetime-local"
            defaultValue={
              initial?.due_at ? formatForDateTimeInput(initial.due_at) : ""
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          />
        </Field>

        <Field label="Class period" htmlFor="class_period_id">
          <select
            id="class_period_id"
            name="class_period_id"
            defaultValue={initial?.class_period_id ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">— Not assigned to a class —</option>
            {classPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {classPeriods.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              You&apos;re not assigned to any class periods yet — ask your
              admin to assign you to a class before publishing.
            </p>
          )}
        </Field>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : isPublished ? (
            "Save changes"
          ) : (
            "Save draft"
          )}
        </button>
      </form>

      {formMode === "edit" && initial && !isPublished && (
        <PublishForm assignmentId={initial.id} />
      )}
    </div>
  );
}

/* ─── Publish form (separate <form> + native confirm) ────────────────── */

function PublishForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(
    publishAssignment,
    initialState
  );

  return (
    <div className="space-y-2">
      {state.error && <Banner kind="error">{state.error}</Banner>}
      <form
        action={action}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Publishing makes this assignment visible to students. You can still edit title, prompt, and due date after publishing."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing…
            </>
          ) : (
            "Publish"
          )}
        </button>
      </form>
    </div>
  );
}

/* ─── Building blocks ────────────────────────────────────────────────── */

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

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
      className={`rounded-md p-4 flex items-start gap-3 border ${
        isError
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-green-50 border-green-200 text-green-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
      )}
      <p className="text-sm">{children}</p>
    </div>
  );
}

/* ─── datetime-local helper ──────────────────────────────────────────── */

function formatForDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
