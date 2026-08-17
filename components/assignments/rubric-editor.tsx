"use client";

/**
 * Editable rubric. Controlled by the parent — receives `value` and
 * emits a new Rubric via `onChange`. The parent serializes to a hidden
 * input so the server action receives JSON. No fetch, no autosave.
 *
 * Two tiers:
 *
 *   1. The performance scale, defined once for the whole rubric — how many
 *      levels, what each is called, and whether the lowest score is 0 or 1.
 *      Rubrics in the wild are not all 4-point and not all bottom out at 1
 *      (JSWP's own starts at 0), so none of that is assumed. Editing the
 *      scale repopulates every criterion.
 *
 *   2. The criteria, each naming one Specific Skill and describing what a
 *      student must demonstrate at each level of the shared scale.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  applyScale,
  deriveScale,
  scaleToLevels,
  newCriterion,
  MAX_LEVELS,
  MIN_LEVELS,
  type Rubric,
  type RubricCriterion,
  type RubricScale,
} from "@/lib/rubric";

export function RubricEditor({
  value,
  onChange,
  disabled,
}: {
  value: Rubric;
  onChange: (next: Rubric) => void;
  disabled?: boolean;
}) {
  // Seeded from the saved criteria so re-opening a rubric shows its real
  // scale; held in state so the teacher can set it up before adding any
  // criterion (with none saved, there is nothing to derive from).
  const [scale, setScale] = useState<RubricScale>(() =>
    deriveScale(value.criteria)
  );

  function changeScale(next: RubricScale) {
    setScale(next);
    onChange({ criteria: applyScale(value.criteria, next) });
  }

  function changeLevelCount(count: number) {
    const clamped = Math.max(MIN_LEVELS, Math.min(MAX_LEVELS, count));
    const labels = Array.from(
      { length: clamped },
      (_, i) => scale.labels[i] ?? ""
    );
    changeScale({ ...scale, labels });
  }

  function changeMilestone(index: number, label: string) {
    changeScale({
      ...scale,
      labels: scale.labels.map((l, i) => (i === index ? label : l)),
    });
  }

  function addCriterion() {
    onChange({ criteria: [...value.criteria, newCriterion(scale)] });
  }
  function removeCriterion(id: string) {
    onChange({ criteria: value.criteria.filter((c) => c.id !== id) });
  }
  function updateCriterion(id: string, patch: Partial<RubricCriterion>) {
    onChange({
      criteria: value.criteria.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    });
  }
  function updateLevelDescription(
    criterionId: string,
    levelIdx: number,
    description: string
  ) {
    onChange({
      criteria: value.criteria.map((c) => {
        if (c.id !== criterionId) return c;
        return {
          ...c,
          levels: c.levels.map((l, i) =>
            i === levelIdx ? { ...l, description } : l
          ),
        };
      }),
    });
  }

  return (
    <fieldset className="space-y-4 bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-semibold text-gray-700 px-1">
          Rubric
        </legend>
        {!disabled && (
          <button
            type="button"
            onClick={addCriterion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add criterion
          </button>
        )}
      </div>

      <ScaleEditor
        scale={scale}
        disabled={disabled}
        onCountChange={changeLevelCount}
        onMilestoneChange={changeMilestone}
        onLowestScoreChange={(lowestScore) =>
          changeScale({ ...scale, lowestScore })
        }
      />

      {value.criteria.length === 0 ? (
        <p className="text-sm text-gray-500">
          No criteria yet. Add one to start grading by rubric.
        </p>
      ) : (
        <div className="space-y-4">
          {value.criteria.map((c, idx) => (
            <CriterionCard
              key={c.id}
              index={idx}
              criterion={c}
              disabled={disabled}
              onChange={(patch) => updateCriterion(c.id, patch)}
              onLevelDescriptionChange={(levelIdx, description) =>
                updateLevelDescription(c.id, levelIdx, description)
              }
              onRemove={() => removeCriterion(c.id)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

/* ─── The shared performance scale ────────────────────────────────── */

function ScaleEditor({
  scale,
  disabled,
  onCountChange,
  onMilestoneChange,
  onLowestScoreChange,
}: {
  scale: RubricScale;
  disabled?: boolean;
  onCountChange: (count: number) => void;
  onMilestoneChange: (index: number, label: string) => void;
  onLowestScoreChange: (lowestScore: number) => void;
}) {
  // Preview the scores the current settings produce, so the teacher sees
  // "3, 2, 1, 0" before saving rather than discovering it at grading time.
  const levels = scaleToLevels(scale);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        Performance levels
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="rubric-level-count"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            How many Performance Levels? (e.g., 1, 2, 3, 4)
          </label>
          <input
            id="rubric-level-count"
            type="number"
            inputMode="numeric"
            min={MIN_LEVELS}
            max={MAX_LEVELS}
            value={scale.labels.length}
            onChange={(e) => onCountChange(Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="rubric-lowest-score"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Lowest score
          </label>
          <select
            id="rubric-lowest-score"
            value={scale.lowestScore}
            onChange={(e) => onLowestScoreChange(Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          >
            <option value={0}>0 (JSWP)</option>
            <option value={1}>1</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-gray-700 mb-1">
          Name the Descriptive Milestones (e.g., Exemplary, Proficient,
          Marginal, Unsatisfactory)
        </legend>
        <ol className="space-y-2">
          {levels.map((level, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className="shrink-0 w-12 text-xs font-semibold text-gray-600"
                aria-hidden="true"
              >
                {level.score}
              </span>
              <input
                type="text"
                value={scale.labels[i] ?? ""}
                onChange={(e) => onMilestoneChange(i, e.target.value)}
                disabled={disabled}
                maxLength={50}
                aria-label={`Milestone name for score ${level.score}`}
                placeholder={`Name for score ${level.score}`}
                className={inputClass}
              />
            </li>
          ))}
        </ol>
      </fieldset>

      <p className="text-xs text-gray-500">
        These levels apply to every criterion below. Scores run{" "}
        {levels.map((l) => l.score).join(", ")}.
      </p>
    </div>
  );
}

/* ─── One criterion ───────────────────────────────────────────────── */

function CriterionCard({
  index,
  criterion,
  disabled,
  onChange,
  onLevelDescriptionChange,
  onRemove,
}: {
  index: number;
  criterion: RubricCriterion;
  disabled?: boolean;
  onChange: (patch: Partial<RubricCriterion>) => void;
  onLevelDescriptionChange: (levelIdx: number, description: string) => void;
  onRemove: () => void;
}) {
  // The criterion id is stable and unique, so it also names the field for
  // its <label> — an input labelled only by proximity is not labelled.
  const skillFieldId = `criterion-${criterion.id}-skill`;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Criterion {index + 1}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove criterion ${index + 1}`}
            className="text-red-700 hover:text-red-900 inline-flex items-center gap-1 text-xs font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>

      <div>
        <label
          htmlFor={skillFieldId}
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Specific Skill
        </label>
        <input
          id={skillFieldId}
          type="text"
          value={criterion.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          maxLength={100}
          placeholder="e.g., Addressing the Prompt; Thesis Statement; Concrete Detail"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {criterion.levels.map((l, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded p-3">
            <div className="text-xs font-medium text-gray-700 mb-2">
              {l.score}
              {l.label ? ` — ${l.label}` : ""}
            </div>
            <textarea
              value={l.description}
              onChange={(e) => onLevelDescriptionChange(i, e.target.value)}
              disabled={disabled}
              rows={2}
              maxLength={500}
              aria-label={`What earns a score of ${l.score}${
                l.label ? ` (${l.label})` : ""
              } for ${criterion.name || `criterion ${index + 1}`}`}
              placeholder="Exactly what a student must demonstrate to earn this score"
              className={`${inputClass} text-xs`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-500 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700 text-sm";
