/**
 * "Has this student touched their work since I sent it back?"
 *
 * A teacher returns a writing and then has no way to tell whether the student
 * has done anything about it. `student_writings.last_student_edit_at`
 * (migration 0054) is bumped by triggers on every artifact table whenever the
 * OWNING student writes, so comparing it against `returned_at` answers the
 * question without opening the writing.
 *
 * Kept pure and separate from the page so the rule is stated once and can be
 * unit tested — the teacher list, and any later surface that wants the same
 * badge, must not each re-derive it slightly differently.
 *
 * Tested in __tests__/lib/revision-signal.test.ts.
 */

export interface RevisionSignalInput {
  readonly status: string;
  readonly returned_at: string | null;
  readonly last_student_edit_at: string | null;
}

/**
 * True when the writing is sitting with the student after feedback AND they
 * have edited something since it was returned.
 *
 * Scoped to `returned` on purpose. Once a student re-submits, the status change
 * is itself the signal and the teacher's "Submitted" section is the right place
 * for it; flagging a submitted or graded writing as "revised" would be noise.
 *
 * Both timestamps must be present. A NULL `last_student_edit_at` means no edit
 * has been recorded — either genuinely none, or the writing predates 0054, and
 * in both cases claiming a revision would be a lie.
 */
export function hasRevisedSinceReturned(w: RevisionSignalInput): boolean {
  if (w.status !== "returned") return false;
  if (!w.returned_at || !w.last_student_edit_at) return false;
  return new Date(w.last_student_edit_at) > new Date(w.returned_at);
}

/**
 * Orders a status section so revised writings come first — those are the ones
 * with something new to read. Within each group the most recent activity leads.
 * Stable for equal keys, so the caller's existing order survives ties.
 */
export function byRevisedThenRecent<T extends RevisionSignalInput & { updated_at: string }>(
  a: T,
  b: T
): number {
  const aRevised = hasRevisedSinceReturned(a);
  const bRevised = hasRevisedSinceReturned(b);
  if (aRevised !== bRevised) return aRevised ? -1 : 1;

  const aAt = a.last_student_edit_at ?? a.updated_at;
  const bAt = b.last_student_edit_at ?? b.updated_at;
  return new Date(bAt).getTime() - new Date(aAt).getTime();
}
