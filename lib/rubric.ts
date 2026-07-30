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

/**
 * `name` is the "Specific Skill" the criterion measures — e.g., Addressing
 * the Prompt; Thesis Statement; Concrete Detail. The criterion-level
 * `description` field was removed (the skill name says what it measures);
 * rubrics saved before that still carry the key in their stored JSON, which
 * is harmless — it is simply no longer read or written.
 */
export interface RubricCriterion {
  id: string;
  name: string;
  levels: RubricLevel[];
}

export interface Rubric {
  criteria: RubricCriterion[];
}

/**
 * The performance scale — how many levels a rubric has and what each is
 * called. Teacher-defined, because rubrics in the wild are not all 4-point
 * and not all bottom out at 1: JSWP's own scale starts at 0.
 *
 * The scale is not stored separately. Every criterion carries the same
 * `levels`, so the scale is derivable from them (`deriveScale`) and the
 * editor keeps them in step (`applyScale`). One source of truth, and the
 * stored JSONB shape that grading, snapshots, and analytics read is
 * unchanged.
 */
export interface RubricScale {
  /** Milestone names, highest performance first. */
  labels: string[];
  /** Score of the lowest level. JSWP starts at 0; other rubrics start at 1. */
  lowestScore: number;
}

/** Below 2 levels a rubric cannot discriminate, and max_score would be 0. */
export const MIN_LEVELS = 2;
export const MAX_LEVELS = 10;

export const DEFAULT_SCALE: RubricScale = {
  labels: ["Exemplary", "Proficient", "Marginal", "Unsatisfactory"],
  lowestScore: 0,
};

/**
 * Expand a scale into levels, highest score first. `existing` carries the
 * per-level descriptions forward, matched by position from the top rather
 * than by score — changing the lowest score renumbers every level, so the
 * score is not a stable identity but the rank is.
 */
export function scaleToLevels(
  scale: RubricScale,
  existing?: readonly RubricLevel[]
): RubricLevel[] {
  const top = scale.lowestScore + scale.labels.length - 1;
  return scale.labels.map((label, i) => ({
    score: top - i,
    label,
    description: existing?.[i]?.description ?? "",
  }));
}

/**
 * Read the scale back off the criteria. All criteria share one scale, so the
 * first well-formed one answers for the rubric; an empty rubric falls back to
 * the default.
 */
export function deriveScale(
  criteria: readonly RubricCriterion[]
): RubricScale {
  const levels = criteria.find((c) => c.levels.length >= MIN_LEVELS)?.levels;
  if (!levels) return { ...DEFAULT_SCALE, labels: [...DEFAULT_SCALE.labels] };
  const ordered = [...levels].sort((a, b) => b.score - a.score);
  return {
    labels: ordered.map((l) => l.label),
    lowestScore: ordered[ordered.length - 1]!.score,
  };
}

/** Re-cut every criterion to `scale`, keeping each one's descriptions. */
export function applyScale(
  criteria: readonly RubricCriterion[],
  scale: RubricScale
): RubricCriterion[] {
  return criteria.map((c) => ({
    ...c,
    levels: scaleToLevels(
      scale,
      [...c.levels].sort((a, b) => b.score - a.score)
    ),
  }));
}

export function emptyRubric(): Rubric {
  return { criteria: [] };
}

export function newCriterion(scale: RubricScale = DEFAULT_SCALE): RubricCriterion {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `crit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    levels: scaleToLevels(scale),
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
  // No description check — criteria stored before the field was removed
  // still carry it, and criteria created since do not.
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
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
 *  - Each criterion needs a non-empty name (the Specific Skill), ≥1 level
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
      return {
        ok: false,
        error: `Criterion ${i + 1}: specific skill is required.`,
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
