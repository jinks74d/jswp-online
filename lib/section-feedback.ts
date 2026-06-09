/**
 * Split a writing's teacher_feedback rows into per-section notes (keyed
 * by step_key) and the overall thread (step_key === null). Pure; unit-
 * tested in __tests__/lib/section-feedback.test.ts.
 *
 * At most one section note per step is expected (the unique index in
 * migration 0030 enforces it). If duplicates ever appear, the newest by
 * created_at wins.
 */

import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

export interface GroupedFeedback {
  readonly byStep: ReadonlyMap<string, FeedbackItemRow>;
  readonly overall: FeedbackItemRow[];
}

export function groupSectionFeedback(
  rows: readonly FeedbackItemRow[]
): GroupedFeedback {
  const byStep = new Map<string, FeedbackItemRow>();
  const overall: FeedbackItemRow[] = [];
  for (const r of rows) {
    if (r.step_key === null) {
      overall.push(r);
      continue;
    }
    const existing = byStep.get(r.step_key);
    if (!existing || r.created_at > existing.created_at) {
      byStep.set(r.step_key, r);
    }
  }
  return { byStep, overall };
}
