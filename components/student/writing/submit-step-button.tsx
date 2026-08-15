"use client";

/**
 * [Submit this step] — sits beside Continue on every non-terminal step.
 *
 * Per-step grades already existed (teacher_feedback.step_key + grade_value);
 * what was missing was the student's half of that exchange. This is the signal
 * that a step is ready to look at, so a teacher can take several grades across
 * a writing rather than only grading the finished piece.
 *
 * Submitting does NOT lock the step (decided with Raymond 2026-08-12). A
 * student who submits early must never be stranded waiting for a teacher to
 * release them, and per-step locking would need its own RLS and a "return this
 * step" action. Editing afterwards is fine and re-flags the writing through the
 * 0054 last_student_edit_at trigger, so a grade taken against an older version
 * surfaces as revised instead of going quietly stale — which is why the button
 * says so out loud rather than implying the step is now frozen.
 *
 * Renders nothing on the terminal step: Continue there already reads [Submit]
 * and sends the whole writing, and two adjacent buttons both saying "submit"
 * different things is how a student submits the wrong one.
 */

import { Check, Loader2, Send } from "lucide-react";
import { submitStep } from "@/lib/actions/student-writings";
import { useWritingMode } from "./use-writing-mode";
import { useServerAction } from "@/hooks/use-server-action";

export function SubmitStepButton({
  writingId,
  stepKey,
  isTerminal = false,
}: {
  writingId: string;
  stepKey: string;
  /** True on the last visible step, where Continue is already the submit. */
  isTerminal?: boolean;
}) {
  const { isReadOnly, submittedSteps } = useWritingMode();
  const { pending, error, run } = useServerAction();

  if (isReadOnly || isTerminal) return null;

  const submittedAt = submittedSteps.get(stepKey) ?? null;

  const onClick = () => {
    run(() => submitStep(writingId, stepKey), {
      fallback: "Could not submit this step.",
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {error && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : submittedAt ? (
            <Check className="h-4 w-4 text-green-700" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {pending
            ? "Submitting…"
            : submittedAt
              ? "Submit again"
              : "Submit this step"}
        </button>
      </div>

      {submittedAt && !pending && (
        <span role="status" className="text-xs text-gray-600">
          Submitted {formatRelative(submittedAt)} — you can still make changes.
        </span>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
