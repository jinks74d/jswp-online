/**
 * Single source of truth for school levels.
 *
 * `schools.level` is a free-text VARCHAR(20) column (no DB enum/CHECK), so the
 * canonical list lives here and is shared by the form dropdown, the school
 * server actions, the CSV importer descriptor, and the detail-page display.
 * Adding a canonical level is a one-line change to `SCHOOL_LEVELS` below.
 *
 * Stored values are slugs (`senior_high`); labels are the display strings.
 * Custom ("Other…") levels are allowed: they're normalized to a slug via
 * `normalizeSchoolLevel` and capped to the 20-char column width.
 */

export type SchoolLevel = {
  readonly value: string;
  readonly label: string;
};

/** Canonical, ordered roughly by grade span. */
export const SCHOOL_LEVELS: readonly SchoolLevel[] = [
  { value: "elementary", label: "Elementary" },
  { value: "k8", label: "K-8" },
  { value: "junior_high", label: "Junior High" },
  { value: "middle", label: "Middle" },
  { value: "high", label: "High" },
  { value: "senior_high", label: "Senior High School" },
  { value: "college", label: "College" },
  { value: "k12", label: "K-12" },
];

/** The sentinel the form uses for the "Other…" free-text choice. */
export const OTHER_LEVEL = "__other__";

const CANONICAL = new Set(SCHOOL_LEVELS.map((l) => l.value));
const LABEL_BY_VALUE = new Map(SCHOOL_LEVELS.map((l) => [l.value, l.label]));

/** True if `value` is one of the canonical, predefined levels. */
export function isCanonicalLevel(value: string): boolean {
  return CANONICAL.has(value);
}

/**
 * Normalize any user-typed level into a stored slug: lowercased, non-alphanumeric
 * runs collapsed to underscores, trimmed of edge underscores, capped at the
 * 20-char column width. Idempotent on canonical slugs. Returns `null` when the
 * input is blank or normalizes to nothing (e.g. "!!!").
 */
export function normalizeSchoolLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20)
    .replace(/_+$/g, ""); // a trailing underscore can survive the slice
  return slug || null;
}

/**
 * Display label for a stored level value. Canonical values use their defined
 * label; custom slugs are title-cased (`vocational_academy` → "Vocational
 * Academy"). Returns `null` for an empty/absent level.
 */
export function schoolLevelLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const canonical = LABEL_BY_VALUE.get(value);
  if (canonical) return canonical;
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
