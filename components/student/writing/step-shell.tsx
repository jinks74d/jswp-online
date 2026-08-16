"use client";

/**
 * The scaffold every per-body-paragraph step screen shares: body-paragraph
 * tabs, an optional source/annotation reference column, and the footer that
 * carries the gate message, the error, [Submit this step] and [Continue].
 *
 * Nine step clients had each re-derived this — roughly 60% of every file, ~130
 * duplicated lines. The pedagogy lives in the panes and in each step's own
 * gate; none of it lives here.
 *
 * ── Why the gate is an opaque string ────────────────────────────────────
 * StepShell takes { canContinue, message } and never sees WHY a step is
 * blocked. That is deliberate, and it is the whole safety property of this
 * refactor.
 *
 * Each step's gate computes something different — the T-Chart distinguishes
 * fictional/WOW/CD/quotation blockers and names the offending CD; shaping
 * names the chunk; elaboration counts phrases per best word. If the shell
 * received structured gate data and rendered the sentence itself, it would
 * have to pick ONE phrasing for ten pedagogical rules, and the specific
 * teaching ("Add quotation marks around the exact words you took from the
 * text") would flatten into a generic "this paragraph isn't ready".
 *
 * Taking a string the step already built means the shell CANNOT homogenise
 * the pedagogy, rather than merely not doing so today.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useWritingMode } from "./use-writing-mode";
import { SubmitStepButton } from "./submit-step-button";

/**
 * What a step owes its footer: may the student advance, and the sentence
 * explaining the answer. The step builds the sentence from its own gate —
 * see the note above.
 */
export interface StepGate {
  canContinue: boolean;
  /** Shown beneath the step whether blocked or ready. Already student-facing. */
  message: string;
}

export interface StepShellProps<T> {
  writingId: string;
  stepKey: string;

  /** Body paragraphs (or gathering sheets) the student tabs between. */
  items: readonly T[];
  /** Stable React key for an item. */
  itemKey: (item: T) => string;
  /** Tab label. Narrative overrides this to name the paragraph's role. */
  tabLabel: (item: T, index: number) => React.ReactNode;
  /** The active item's editing surface — the step's actual content. */
  renderPane: (item: T, index: number) => React.ReactNode;
  /** Shown when the student has no body paragraphs yet. */
  emptyMessage?: string;

  gate: StepGate;
  onContinue: () => void;
  pending: boolean;
  error: string | null;

  /**
   * Last visible step. Continue reads [Submit] and the separate
   * [Submit this step] button hides, because two adjacent buttons saying
   * "submit" different things is how a student submits the wrong one.
   */
  isTerminal?: boolean;

  /** Source text + annotations column. Omit on steps that have no source. */
  reference?: React.ReactNode;
}

export function StepShell<T>({
  writingId,
  stepKey,
  items,
  itemKey,
  tabLabel,
  renderPane,
  emptyMessage = "No body paragraphs yet. Reload to bootstrap.",
  gate,
  onContinue,
  pending,
  error,
  isTerminal = false,
  reference,
}: StepShellProps<T>) {
  // Read-only is StepFooter's concern — the panes and tabs stay visible so a
  // teacher can review the student's work.
  const [activeIdx, setActiveIdx] = useState(0);

  // Falls back to the first item so a stale index (a paragraph removed under
  // the student) renders the step instead of the empty state.
  const activeItem = items[activeIdx] ?? items[0];
  const showReference = reference != null;

  const formColumn = (
    <div className="space-y-4 min-w-0">
      {items.length > 1 && (
        <div
          role="tablist"
          aria-label="Body paragraphs"
          className="flex gap-1 border-b border-gray-200 overflow-x-auto"
        >
          {items.map((item, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={itemKey(item)}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveIdx(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  active
                    ? "text-gray-900"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
                style={active ? { borderBottomColor: "var(--brand)" } : undefined}
              >
                {tabLabel(item, i)}
              </button>
            );
          })}
        </div>
      )}

      {activeItem ? (
        renderPane(activeItem, items.indexOf(activeItem))
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {showReference && (
        <details className="lg:hidden bg-white border border-gray-200 rounded-lg group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Source text &amp; annotations
            </span>
            <span className="text-xs text-gray-500 group-open:hidden">Show</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            {reference}
          </div>
        </details>
      )}

      <div
        className={`grid gap-6 ${
          showReference ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "grid-cols-1"
        }`}
      >
        {formColumn}

        {showReference && (
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            {reference}
          </aside>
        )}
      </div>

      <StepFooter
        writingId={writingId}
        stepKey={stepKey}
        gate={gate}
        onContinue={onContinue}
        pending={pending}
        error={error}
        isTerminal={isTerminal}
      />
    </div>
  );
}

export interface StepFooterProps {
  writingId: string;
  stepKey: string;
  gate: StepGate;
  onContinue: () => void;
  pending: boolean;
  error: string | null;
  isTerminal?: boolean;
}

/**
 * The gate message, error, [Submit this step] and [Continue] row.
 *
 * Exported separately because two steps are laid out as a single scrolling
 * page rather than tabs — Gathering CDs stacks a sheet per body paragraph, and
 * Topic Sentences stacks a textarea per paragraph so a student can see them
 * together. Those two need this footer but must NOT be forced into tabs; the
 * stacked layout is the pedagogy, not an inconsistency to iron out.
 *
 * Renders nothing in read-only mode — a teacher reviewing a writing has no
 * Continue to press.
 */
export function StepFooter({
  writingId,
  stepKey,
  gate,
  onContinue,
  pending,
  error,
  isTerminal = false,
}: StepFooterProps) {
  const { isReadOnly } = useWritingMode();
  if (isReadOnly) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
      <div className="text-xs text-gray-500">{gate.message}</div>
      <div className="flex items-center gap-3">
        {error && (
          <div className="text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <SubmitStepButton
          writingId={writingId}
          stepKey={stepKey}
          isTerminal={isTerminal}
        />
        <button
          type="button"
          onClick={onContinue}
          disabled={!gate.canContinue || pending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {pending && (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          )}
          {pending
            ? isTerminal
              ? "Submitting…"
              : "Saving…"
            : isTerminal
              ? "Submit"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}
