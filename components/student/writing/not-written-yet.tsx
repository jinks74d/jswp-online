"use client";

/**
 * The empty state for a step whose backing row doesn't exist yet.
 *
 * Two very different readers hit this, and they need different things said:
 *
 *   * The STUDENT sees it only if bootstrap genuinely failed — the step
 *     components create their rows on render, so an absent row is a transient
 *     fault. "Reload to retry" is the right instruction.
 *
 *   * The TEACHER sees it whenever the student simply hasn't reached this step.
 *     `bootstrapParagraphForms` and friends early-return for non-students
 *     (a teacher must never author rows into a student's work), so a
 *     not-yet-written step is *expected* on the review surface, not an error.
 *     Telling her to reload is both wrong and slightly alarming — nothing will
 *     change however many times she does.
 *
 * This mattered more once the review surface began leading with the finished
 * writing (lib/review-order.ts): on an in-progress submission the very first
 * thing a teacher now sees is this state, so it has to read as "not here yet"
 * rather than as a broken page.
 */

import { FileQuestion } from "lucide-react";
import { useWritingMode } from "./use-writing-mode";

export function NotWrittenYet({
  /** What's missing, in the student's language — e.g. "final paragraph". */
  artifact,
}: {
  artifact: string;
}) {
  const { isReadOnly } = useWritingMode();

  if (isReadOnly) {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
        <FileQuestion
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-stone-500"
          aria-hidden="true"
        />
        <span>
          No {artifact} yet — this student hasn&apos;t reached this step.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Your {artifact} hasn&apos;t been set up yet. Reload the page to retry.
    </div>
  );
}
