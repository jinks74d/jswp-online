/**
 * Feedback-area grade formats (number / letter / check). Pure; unit-tested.
 * Grades are stored as TEXT and interpreted per the writing's grade_format.
 */

export const LETTER_GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
] as const;

export type GradeFormat = "none" | "number" | "letter" | "check";

/** Validate a stored value against the active format. Empty string = cleared. */
export function isValidGrade(format: GradeFormat, value: string): boolean {
  const v = value.trim();
  switch (format) {
    case "none":
      return v.length === 0;
    case "number": {
      if (v.length === 0) return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    }
    case "letter":
      return v.length === 0 || (LETTER_GRADES as readonly string[]).includes(v);
    case "check":
      return v.length === 0 || v === "check" || v === "x";
  }
}

/** Render a stored value for a read-only badge ('' when nothing to show). */
export function formatGradeLabel(format: GradeFormat, value: string): string {
  const v = value.trim();
  if (v.length === 0 || format === "none") return "";
  if (format === "check") return v === "check" ? "✓" : v === "x" ? "✗" : "";
  return v;
}
