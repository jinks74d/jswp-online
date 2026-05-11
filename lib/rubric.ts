/**
 * Rubric type + validators for the assignments.rubric JSONB column.
 *
 * Null and { criteria: [] } are treated identically as "empty rubric"
 * — the editor's initial state is { criteria: [] } whether the column
 * is null or empty, and the action always writes { criteria: [] }
 * (never null) so Phase 4/5 rendering doesn't have to null-check.
 *
 * Criterion ids are crypto.randomUUID() generated in the editor and
 * persisted; chunk 5.1 grading references them from
 * rubric_scores.criterion_id (with snapshot fields so historical grades
 * survive later rubric edits).
 */

export interface RubricLevel {
  score: number;
  label: string;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  levels: RubricLevel[];
}

export interface Rubric {
  criteria: RubricCriterion[];
}

export const DEFAULT_LEVELS: readonly RubricLevel[] = [
  { score: 4, label: "Exemplary", description: "" },
  { score: 3, label: "Proficient", description: "" },
  { score: 2, label: "Developing", description: "" },
  { score: 1, label: "Beginning", description: "" },
];

export function emptyRubric(): Rubric {
  return { criteria: [] };
}

export function newCriterion(): RubricCriterion {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `crit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    description: "",
    levels: DEFAULT_LEVELS.map((l) => ({ ...l })),
  };
}

/**
 * Read-side coercion. `null`, missing, malformed, or { criteria: [] }
 * all collapse to { criteria: [] }. Defensive: if the JSON is partially
 * malformed (e.g. one criterion missing `levels`), drop the bad entries
 * rather than throw.
 */
export function loadRubric(raw: unknown): Rubric {
  if (raw == null) return emptyRubric();
  if (typeof raw !== "object") return emptyRubric();
  const criteria = (raw as { criteria?: unknown }).criteria;
  if (!Array.isArray(criteria)) return emptyRubric();
  const filtered = criteria.filter(isCriterion);
  return { criteria: filtered };
}

function isLevel(v: unknown): v is RubricLevel {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.score === "number" &&
    typeof o.label === "string" &&
    typeof o.description === "string"
  );
}

function isCriterion(v: unknown): v is RubricCriterion {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.description === "string" &&
    Array.isArray(o.levels) &&
    o.levels.every(isLevel)
  );
}

export type RubricValidationResult =
  | { ok: true; value: Rubric }
  | { ok: false; error: string };

/**
 * Write-side validator. Used by the server action before persisting.
 * Accepts both `null` and a Rubric object. Returns a normalized Rubric
 * in the success branch.
 *
 * Rules:
 *  - `null` → { criteria: [] }
 *  - { criteria: [] } → { criteria: [] }
 *  - Each criterion needs non-empty name + description, ≥1 level
 *  - Each level needs a non-empty label
 */
export function validateRubric(raw: unknown): RubricValidationResult {
  if (raw == null) return { ok: true, value: emptyRubric() };
  if (typeof raw !== "object") {
    return { ok: false, error: "Rubric must be an object." };
  }
  const criteria = (raw as { criteria?: unknown }).criteria;
  if (!Array.isArray(criteria)) {
    return { ok: false, error: "Rubric.criteria must be an array." };
  }

  const out: RubricCriterion[] = [];
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    if (!isCriterion(c)) {
      return { ok: false, error: `Criterion ${i + 1} is malformed.` };
    }
    if (!c.name.trim()) {
      return { ok: false, error: `Criterion ${i + 1}: name is required.` };
    }
    if (!c.description.trim()) {
      return {
        ok: false,
        error: `Criterion ${i + 1}: description is required.`,
      };
    }
    if (c.levels.length === 0) {
      return {
        ok: false,
        error: `Criterion ${i + 1}: at least one level is required.`,
      };
    }
    for (let j = 0; j < c.levels.length; j++) {
      if (!c.levels[j].label.trim()) {
        return {
          ok: false,
          error: `Criterion ${i + 1} level ${j + 1}: label is required.`,
        };
      }
    }
    out.push(c);
  }

  return { ok: true, value: { criteria: out } };
}
