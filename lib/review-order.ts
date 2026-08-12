/**
 * The order a teacher reads a submission in, which is NOT the order the
 * student wrote it in.
 *
 * A student walks Decode → Annotate → Gather → T-Chart → Shaping → Paragraph
 * Form, and the review surface used to mirror that exactly. But a teacher
 * grades the other way round: read the finished writing first, and only when
 * something is wrong with it go back through the scaffolding to find where it
 * went wrong. Leading with Decode the Prompt buries the thing she actually
 * came to read under six sections of process.
 *
 * So the finished work is hoisted to the top and the process follows,
 * otherwise untouched. Splitting rather than flattening lets the caller put a
 * divider between the two, so the reordering reads as deliberate instead of
 * looking like a bug.
 *
 * Tested in __tests__/lib/review-order.test.ts.
 */

/** Finished-writing artifacts, in the order a teacher wants them. */
const OUTCOME_ORIGINS = ["final_draft", "paragraph_form"] as const;

export interface ReviewOrdered<T> {
  /** The finished writing — Final Draft, then the assembled paragraph(s). */
  readonly outcome: readonly T[];
  /** Everything that produced it, in the student's own sequence. */
  readonly process: readonly T[];
}

/**
 * Split a mode's visible steps into what the student produced and how they got
 * there.
 *
 * `final_draft` leads `paragraph_form` because on an essay the draft is the
 * whole assembled piece while the paragraph forms are its parts. On a
 * single-paragraph assignment there is no `final_draft` step at all (it is
 * essayOnly), so the outcome is just "The Final Paragraph" — which is exactly
 * the section this reordering exists to surface.
 */
export function orderStepsForReview<T extends { readonly groupOrigin: string }>(
  steps: readonly T[]
): ReviewOrdered<T> {
  const outcome: T[] = [];
  for (const origin of OUTCOME_ORIGINS) {
    for (const step of steps) {
      if (step.groupOrigin === origin) outcome.push(step);
    }
  }

  const process = steps.filter(
    (s) => !OUTCOME_ORIGINS.includes(s.groupOrigin as (typeof OUTCOME_ORIGINS)[number])
  );

  return { outcome, process };
}
