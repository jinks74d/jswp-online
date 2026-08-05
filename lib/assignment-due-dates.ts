/**
 * Due dates when one assignment reaches several class periods (migration 0050).
 *
 * Two levels, deliberately:
 *   * `assignments.due_at`            — the DEFAULT, and what a teacher who
 *                                       wants one deadline for every class
 *                                       sets once.
 *   * `assignment_class_periods.due_at` — that period's OWN deadline. NULL
 *                                       means "inherit the default".
 *
 * Period 1 meets Monday and Period 6 meets Tuesday, so the deadline belongs to
 * the pairing rather than to the assignment. Storing NULL rather than copying
 * the default down is what lets a later edit to the default move every class
 * that never overrode it — copying would silently decouple them.
 *
 * Nothing outside this module should read either column directly; go through
 * `effectiveDueAt` so the fallback rule lives in exactly one place.
 */

/** The per-period rows an assignment carries, as far as due dates care. */
export type PeriodDueDate = {
  class_period_id: string;
  /** NULL inherits the assignment default. */
  due_at: string | null;
};

/**
 * One row of the form's period picker. `due_at` is a `<input type="date">`
 * value (`""` or `YYYY-MM-DD`) rather than a timestamp — the empty string is
 * how "inherit the assignment default" arrives from the DOM, and the server
 * turns it into NULL.
 */
export type AssignmentPeriodSelection = {
  class_period_id: string;
  due_at: string;
};

/**
 * The deadline that actually applies to `classPeriodId`.
 *
 * Returns the assignment default when the period has no override, and when the
 * period is not among the assignment's periods at all — a caller asking about
 * an unrelated period gets the assignment-level answer rather than a crash.
 */
export function effectiveDueAt(
  assignmentDueAt: string | null,
  periods: readonly PeriodDueDate[],
  classPeriodId: string | null
): string | null {
  if (!classPeriodId) return assignmentDueAt;
  const row = periods.find((p) => p.class_period_id === classPeriodId);
  if (!row) return assignmentDueAt;
  return row.due_at ?? assignmentDueAt;
}

/**
 * Every distinct deadline across an assignment's periods, earliest first.
 *
 * Teacher-facing surfaces list one assignment for all its classes, so "Due
 * Mar 3" is only honest when the classes agree. Use `hasVaryingDueDates` to
 * decide between showing the single date and showing a range.
 */
export function distinctDueDates(
  assignmentDueAt: string | null,
  periods: readonly PeriodDueDate[]
): string[] {
  const seen = new Set<string>();
  for (const p of periods) {
    const d = p.due_at ?? assignmentDueAt;
    if (d) seen.add(d);
  }
  // Compare as instants, not strings: two timestamps for the same moment can
  // be serialized with different offsets, and lexical order would disagree
  // with chronological order.
  return [...seen].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
}

/** True when the assignment's periods do not all share one deadline. */
export function hasVaryingDueDates(
  assignmentDueAt: string | null,
  periods: readonly PeriodDueDate[]
): boolean {
  return distinctDueDates(assignmentDueAt, periods).length > 1;
}

/**
 * The earliest deadline across all periods — the one a teacher's list view
 * should lead with, since it is the first date any student is held to.
 * Falls back to the assignment default when there are no periods yet (a draft
 * that has not been assigned to anything).
 */
export function earliestDueAt(
  assignmentDueAt: string | null,
  periods: readonly PeriodDueDate[]
): string | null {
  return distinctDueDates(assignmentDueAt, periods)[0] ?? assignmentDueAt;
}
