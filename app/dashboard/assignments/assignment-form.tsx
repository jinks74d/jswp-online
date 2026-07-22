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

import React, { useActionState, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  createDraftAssignment,
  updateDraftAssignment,
  publishAssignment,
  deleteAssignment,
  cancelAssignment,
  unpublishAssignment,
  type AssignmentFormState,
} from "@/lib/actions/assignments";
import { createBrowserClient } from "@/lib/supabase/client";
import { loadRubric, type Rubric } from "@/lib/rubric";
import {
  SourceTextFields,
  type SourceInitial,
} from "@/components/assignments/source-text-fields";
import { RubricEditor } from "@/components/assignments/rubric-editor";

type Mode = "expository" | "argumentation" | "literary" | "narrative";
type ChunkRatio =
  | "lit_one_to_two_plus"
  | "lit_three_plus_to_zero"
  | "nar_two_plus_to_one"
  | "nonlit_summary_three_plus_to_zero"
  | "nonlit_expository_two_plus_to_one"
  | "nonlit_argumentation_two_plus_to_one"
  | "nonlit_expository_one_to_one";

// Ratio choices are genre-specific: the enum encodes genre + proportion, so
// each mode exposes only its valid ratio(s). Literary is locked (rendered as a
// hidden input, not this list). Expository is the only mode with a real choice
// (standard 2+:1 vs. summary 3+:0).
const RATIO_OPTIONS: Record<Mode, { value: ChunkRatio; label: string }[]> = {
  literary: [
    { value: "lit_one_to_two_plus", label: "1:2+ — Literary analysis" },
  ],
  narrative: [
    { value: "nar_two_plus_to_one", label: "2+:1 — Narrative" },
  ],
  argumentation: [
    {
      value: "nonlit_argumentation_two_plus_to_one",
      label: "2+:1 — Argumentation",
    },
  ],
  expository: [
    {
      value: "nonlit_expository_two_plus_to_one",
      label:
        "(2+:1) – two or more sentences of concrete detail to one sentence of commentary",
    },
    {
      value: "nonlit_summary_three_plus_to_zero",
      label:
        "(3+:0) – three or more sentences of concrete detail; no commentary",
    },
    {
      value: "nonlit_expository_one_to_one",
      label: "(1:1) – APUSH, AP World History",
    },
  ],
};

// Field copy varies by mode — the shared form component stays single, but each
// mode speaks its own language. Only expository diverges today; the other three
// fall back to the neutral defaults until their copy is specified.
type FormCopy = {
  titleLabel: string;
  titlePlaceholder: string;
  titleDescription?: string;
  promptLabel: string;
  promptPlaceholder: string;
  promptDescription?: string;
  essayLabel: string;
  essayAside?: string;
  essayUncheckedHint: string;
  ratioLabel: string;
  sourceLegend: string;
  citationExample?: string;
};

const DEFAULT_FORM_COPY: FormCopy = {
  titleLabel: "Title",
  titlePlaceholder: "e.g. Sports & Teamwork",
  promptLabel: "Prompt",
  promptPlaceholder: "Write the question or task students will respond to.",
  essayLabel: "Essay format",
  essayAside: "(multiple body paragraphs)",
  essayUncheckedHint:
    "Unchecked: students write a single one-chunk paragraph (e.g. a 3+:0 summary).",
  ratioLabel: "Chunk ratio",
  sourceLegend: "Source text",
};

const FORM_COPY: Record<Mode, FormCopy> = {
  expository: {
    titleLabel: "Name of Unit or Assignment",
    titlePlaceholder: "",
    titleDescription:
      "e.g., ecosystems, early colonization, volume/surface area, the Enlightenment",
    promptLabel: "Writing Prompt",
    promptPlaceholder: "",
    promptDescription:
      "Written as statements, not questions; quantifies the assignment (length and ratio); uses verbs that fit the subject and assignment; narrows the focus of the topic.",
    essayLabel: "Multi-paragraph Essay",
    essayUncheckedHint:
      "Unchecked: students write a single paragraph (body, introduction, or conclusion).",
    ratioLabel: "The JSWP® Ratio",
    sourceLegend: "Primary or Secondary Sources",
    citationExample:
      'e.g., Dweck, Carol S. “The Secret to Raising Smart Kids.” Scientific American Mind, vol. 18, no. 6, Dec. 2007 / Jan. 2008, pp. 36–43.',
  },
  argumentation: DEFAULT_FORM_COPY,
  literary: DEFAULT_FORM_COPY,
  narrative: DEFAULT_FORM_COPY,
};

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
  sources: SourceInitial[];
  rubric: unknown;
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
  schoolId,
  studentWritingCount = 0,
}: {
  formMode: "create" | "edit";
  mode: Mode;
  initial?: AssignmentInitial;
  classPeriods: ClassPeriodOption[];
  schoolId: string;
  studentWritingCount?: number;
}) {
  const copy = FORM_COPY[mode];
  const isPublished = initial?.released_at != null;
  const isLiterary = mode === "literary";
  const isArgumentation = mode === "argumentation";
  const showSourceText = mode !== "narrative";

  const [isEssay, setIsEssay] = useState<boolean>(initial?.is_essay ?? false);
  const [numBP, setNumBP] = useState<number>(
    initial?.num_body_paragraphs ?? 3
  );
  const [chunksPerBP, setChunksPerBP] = useState<number>(
    initial?.default_chunks_per_bp ?? 1
  );
  const [chunkRatio, setChunkRatio] = useState<ChunkRatio>(
    initial?.default_chunk_ratio ??
      (isLiterary ? "lit_one_to_two_plus" : RATIO_OPTIONS[mode][0].value)
  );
  const [hasCounter, setHasCounter] = useState<boolean>(
    initial?.has_counterargument ?? false
  );
  const [rubric, setRubric] = useState<Rubric>(() =>
    loadRubric(initial?.rubric ?? null)
  );

  // Browser supabase client for the storage upload — created once.
  const supabase = useMemo(() => createBrowserClient(), []);

  // Source-file archival needs an assignment id BEFORE the row exists (the
  // file is uploaded client-side at pick time, not via the server action). On
  // create we mint a stable id up front so the upload lands under
  // assignment-{id}/ and source_file_path persists. Generated in an effect
  // (not during render) so SSR and first client render agree — avoids a
  // hydration mismatch. The id is a storage-folder key only; the DB row keeps
  // its own generated id (no cleanup keys on this folder, so they need not match).
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null);
  useEffect(() => {
    if (formMode === "create") setDraftSourceId(crypto.randomUUID());
  }, [formMode]);
  const sourceAssignmentId = initial?.id ?? draftSourceId ?? undefined;

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
        className="space-y-5 bg-white border border-stone-200 rounded-xl shadow-sm p-6"
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
            value="lit_one_to_two_plus"
          />
        )}

        <Field
          label={copy.titleLabel}
          htmlFor="title"
          error={state.fieldErrors?.title}
          description={copy.titleDescription}
        >
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={255}
            defaultValue={initial?.title ?? ""}
            className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={copy.titlePlaceholder}
          />
        </Field>

        <Field
          label={copy.promptLabel}
          htmlFor="prompt"
          error={state.fieldErrors?.prompt}
          description={copy.promptDescription}
        >
          <textarea
            id="prompt"
            name="prompt"
            required
            rows={5}
            maxLength={5000}
            defaultValue={initial?.prompt ?? ""}
            className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={copy.promptPlaceholder}
          />
        </Field>

        <div>
          <label
            htmlFor="is_essay"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="is_essay"
              type="checkbox"
              name="is_essay"
              checked={isEssay}
              onChange={(e) => handleIsEssayChange(e.target.checked)}
              disabled={isPublished}
              aria-describedby={!isEssay ? "is_essay-hint" : undefined}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-900">
              {copy.essayLabel}
            </span>
            {copy.essayAside && (
              <span className="text-stone-600">{copy.essayAside}</span>
            )}
          </label>
          {!isEssay && (
            <p id="is_essay-hint" className="mt-1 text-xs text-stone-600">
              {copy.essayUncheckedHint}
            </p>
          )}
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
                className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900 disabled:bg-stone-50"
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
                className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900 disabled:bg-stone-50"
              />
            </Field>
          </div>
        )}

        {!isLiterary && (
          <Field label={copy.ratioLabel} htmlFor="chunk_ratio">
            <select
              id="chunk_ratio"
              name="default_chunk_ratio"
              value={chunkRatio}
              onChange={(e) => setChunkRatio(e.target.value as ChunkRatio)}
              disabled={isPublished}
              className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900 disabled:bg-stone-50"
            >
              {RATIO_OPTIONS[mode].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {isLiterary && (
          <p className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded p-3">
            Literary mode uses a fixed 1:2+ ratio (one detail with at least
            two commentary moves).
          </p>
        )}

        {isArgumentation && (
          <div>
            <label
              htmlFor="has_counterargument"
              className="flex items-center gap-2 text-sm"
            >
              <input
                id="has_counterargument"
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

        {showSourceText && (
          <SourceTextFields
            initial={initial?.sources}
            disabled={isPublished}
            schoolId={schoolId}
            assignmentId={sourceAssignmentId}
            supabase={supabase}
            legend={copy.sourceLegend}
            citationExample={copy.citationExample}
          />
        )}

        <RubricEditor
          value={rubric}
          onChange={setRubric}
          disabled={isPublished}
        />
        <input type="hidden" name="rubric" value={JSON.stringify(rubric)} />
        {state.fieldErrors?.rubric && (
          <p
            id="rubric-error"
            role="alert"
            className="text-sm text-red-600"
          >
            {state.fieldErrors.rubric}
          </p>
        )}

        <Field
          label="Due Date"
          htmlFor="due_at"
          error={state.fieldErrors?.due_at}
        >
          <input
            id="due_at"
            name="due_at"
            type="date"
            required
            defaultValue={
              initial?.due_at ? formatForDateInput(initial.due_at) : ""
            }
            className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900"
          />
        </Field>

        <Field label="Class Period or Block" htmlFor="class_period_id">
          <select
            id="class_period_id"
            name="class_period_id"
            defaultValue={initial?.class_period_id ?? ""}
            className="w-full px-3 py-2 border border-stone-400 rounded-md text-gray-900"
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
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : isPublished ? (
            "Save changes"
          ) : (
            "Save draft"
          )}
        </button>
      </form>

      {formMode === "edit" && initial && (
        <DangerZone
          assignmentId={initial.id}
          isPublished={isPublished}
          studentWritingCount={studentWritingCount}
        />
      )}
    </div>
  );
}

/* ─── Danger zone (publish / unpublish / delete) ─────────────────────── */

function DangerZone({
  assignmentId,
  isPublished,
  studentWritingCount,
}: {
  assignmentId: string;
  isPublished: boolean;
  studentWritingCount: number;
}) {
  const hasWritings = studentWritingCount > 0;

  return (
    <div className="space-y-2">
      {!isPublished && <PublishForm assignmentId={assignmentId} />}
      {!isPublished && !hasWritings && <DeleteForm assignmentId={assignmentId} />}
      {isPublished && (
        <UnpublishForm
          assignmentId={assignmentId}
          studentWritingCount={studentWritingCount}
        />
      )}

      {hasWritings && (
        <div className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700 space-y-3">
          <p>
            {studentWritingCount} student
            {studentWritingCount === 1 ? " has" : "s have"} started writing on
            this assignment. Plain delete is disabled to protect their work,
            and unpublishing only hides it temporarily (their work is preserved
            and reappears when you re-publish).
          </p>
          <p>
            If you need to remove this assignment for everyone — students
            included — <strong>cancelling permanently deletes the assignment
            and all {studentWritingCount} student writing
            {studentWritingCount === 1 ? "" : "s"}</strong>. This cannot be
            undone.
          </p>
          <CancelForm
            assignmentId={assignmentId}
            studentWritingCount={studentWritingCount}
          />
        </div>
      )}
    </div>
  );
}

function CancelForm({
  assignmentId,
  studentWritingCount,
}: {
  assignmentId: string;
  studentWritingCount: number;
}) {
  const [state, action, pending] = useActionState(
    cancelAssignment,
    initialState
  );

  const confirmMessage = `Cancel this assignment? This permanently deletes the assignment and all ${studentWritingCount} student writing${
    studentWritingCount === 1 ? "" : "s"
  }, and cannot be undone.`;

  return (
    <div className="space-y-2">
      {state.error && <Banner kind="error">{state.error}</Banner>}
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-600 bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Cancelling…
            </>
          ) : (
            <>
              <Ban className="w-4 h-4" aria-hidden="true" />
              Cancel assignment &amp; delete all work
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function DeleteForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(
    deleteAssignment,
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
              "Delete this draft? This cannot be undone."
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-300 bg-white text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Deleting…
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete draft
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function UnpublishForm({
  assignmentId,
  studentWritingCount,
}: {
  assignmentId: string;
  studentWritingCount: number;
}) {
  const [state, action, pending] = useActionState(
    unpublishAssignment,
    initialState
  );

  const confirmMessage =
    studentWritingCount > 0
      ? `Unpublish this assignment? ${studentWritingCount} student${
          studentWritingCount === 1 ? "" : "s"
        } ${
          studentWritingCount === 1 ? "has" : "have"
        } already started writing and will TEMPORARILY lose access to their work until you publish again. Their work is not deleted. Continue?`
      : "Unpublish this assignment? Students won't see it until you publish again.";

  return (
    <div className="space-y-2">
      {state.error && <Banner kind="error">{state.error}</Banner>}
      {state.success && <Banner kind="success">{state.success}</Banner>}
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Unpublishing…
            </>
          ) : (
            <>
              <Undo2 className="w-4 h-4" aria-hidden="true" />
              Unpublish
            </>
          )}
        </button>
      </form>
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
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
  description,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const descId = description ? `${htmlFor}-desc` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy =
    [hintId, descId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-xs text-stone-600">
            {hint}
          </span>
        )}
      </div>
      {/* Thread error/hint association onto the single field control. The
          control passes `id={htmlFor}`; here we add aria-describedby and
          aria-invalid so SRs announce the hint + error and the invalid state. */}
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{
              "aria-describedby"?: string;
              "aria-invalid"?: boolean;
            }>,
            {
              "aria-describedby": describedBy,
              "aria-invalid": error ? true : undefined,
            }
          )
        : children}
      {description && (
        <p id={descId} className="mt-1 text-xs text-stone-600">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
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
        <AlertCircle
          className="w-5 h-5 mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="w-5 h-5 mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      <p className="text-sm">{children}</p>
    </div>
  );
}

/* ─── date-input helper ──────────────────────────────────────────────── */

// The <input type="date"> value is a bare YYYY-MM-DD. A date-only due_at is
// stored as UTC midnight (new Date("YYYY-MM-DD")), so read it back with UTC
// components to round-trip to the same calendar day regardless of viewer tz.
function formatForDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`;
}
