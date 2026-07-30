/**
 * Pure decision logic for the source_html backfill. Kept separate from the I/O
 * runner (backfill-source-html.ts) so the data-safety rules are unit-tested.
 *
 * Policy (chosen 2026-06-16): force-update every re-convertible .docx source so
 * formatting reaches previously-added assignments. Because the original
 * sanitizer used KEEP_CONTENT, the re-derived substrate is expected to equal
 * the stored source_text, so annotation offsets normally do not move — but when
 * they DO change and annotations already exist, the runner reports it (the
 * annotationsAtRisk flag) so the operator can review shifted highlights.
 */

export interface BackfillInput {
  /** assignment has a stored source_file_path. */
  readonly hasFile: boolean;
  /** the stored file is a .docx (the only re-convertible type here). */
  readonly isDocx: boolean;
  /** current assignments.source_text. */
  readonly oldText: string;
  /** substrate re-derived from the freshly re-converted .docx. */
  readonly newSubstrate: string;
  /** number of saved annotations across the assignment's writings. */
  readonly annotationCount: number;
}

export type BackfillPlan =
  | { action: "skip"; reason: "no-file" | "not-docx" }
  | { action: "update"; textChanged: boolean; annotationsAtRisk: boolean };

export function planBackfill(input: BackfillInput): BackfillPlan {
  if (!input.hasFile) return { action: "skip", reason: "no-file" };
  if (!input.isDocx) return { action: "skip", reason: "not-docx" };

  const textChanged = input.newSubstrate !== input.oldText;
  return {
    action: "update",
    textChanged,
    annotationsAtRisk: textChanged && input.annotationCount > 0,
  };
}
