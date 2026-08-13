/**
 * "Does this assignment have feedback the student still needs to look at?"
 *
 * The student list's Feedback tab used to filter on `status === "returned"`,
 * which was accurate only while feedback arrived exclusively by returning a
 * finished submission. Per-step grading changed that: a teacher marks
 * individual steps as they come in, so a note routinely lands on an
 * `in_progress` or `submitted` writing. Those assignments then sorted into
 * "In progress" and never appeared under Feedback at all — the tab quietly
 * meant something other than its label.
 *
 * Kept pure and shared so the tab, the counts and the ordering can't drift
 * apart, and so the rule is testable without rendering a page.
 *
 * Tested in __tests__/lib/student-feedback.test.ts.
 */

export interface FeedbackFilterInput {
  readonly status: string;
  readonly feedback: { readonly total: number; readonly unresolved: number } | null;
}

/**
 * True when the assignment should appear under Feedback.
 *
 * Two ways to qualify:
 *   * unresolved notes — the student has something left to read or act on,
 *     whatever status the writing is in; and
 *   * a returned writing, always. Returning is itself the teacher asking for
 *     changes, so it belongs here even when she left no written note — which
 *     is exactly what the card says with "Feedback waiting".
 *
 * A graded writing whose notes have all been worked through drops out. Its
 * feedback is still readable on the card and in the writing, but it is no
 * longer something waiting on the student.
 */
export function hasNewFeedback(item: FeedbackFilterInput): boolean {
  if ((item.feedback?.unresolved ?? 0) > 0) return true;
  return item.status === "returned";
}

/**
 * Sorts assignments with feedback to the front, leaving everything else in the
 * order it arrived (the query's due-date ordering). Array.prototype.sort is
 * stable in modern JS, so equal items keep their relative positions.
 */
export function byFeedbackFirst<T extends FeedbackFilterInput>(
  a: T,
  b: T
): number {
  const aNew = hasNewFeedback(a);
  const bNew = hasNewFeedback(b);
  if (aNew === bNew) return 0;
  return aNew ? -1 : 1;
}
