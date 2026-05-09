"use client";

/**
 * Editable rubric. Controlled by the parent — receives `value` and
 * emits a new Rubric via `onChange`. The parent serializes to a hidden
 * input so the server action receives JSON. No fetch, no autosave.
 */

import { Plus, Trash2 } from "lucide-react";
import {
  type Rubric,
  type RubricCriterion,
  newCriterion,
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
  function addCriterion() {
    onChange({ criteria: [...value.criteria, newCriterion()] });
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
  function updateLevel(
    criterionId: string,
    levelIdx: number,
    patch: { label?: string; description?: string }
  ) {
    onChange({
      criteria: value.criteria.map((c) => {
        if (c.id !== criterionId) return c;
        return {
          ...c,
          levels: c.levels.map((l, i) =>
            i === levelIdx ? { ...l, ...patch } : l
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
              onLevelChange={(levelIdx, patch) =>
                updateLevel(c.id, levelIdx, patch)
              }
              onRemove={() => removeCriterion(c.id)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function CriterionCard({
  index,
  criterion,
  disabled,
  onChange,
  onLevelChange,
  onRemove,
}: {
  index: number;
  criterion: RubricCriterion;
  disabled?: boolean;
  onChange: (patch: Partial<RubricCriterion>) => void;
  onLevelChange: (
    levelIdx: number,
    patch: { label?: string; description?: string }
  ) => void;
  onRemove: () => void;
}) {
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
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={criterion.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          maxLength={100}
          placeholder="e.g. Thesis clarity"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={criterion.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={disabled}
          rows={2}
          maxLength={1000}
          placeholder="What this criterion measures."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {criterion.levels.map((l, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded p-3">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Score {l.score}
            </div>
            <input
              type="text"
              value={l.label}
              onChange={(e) => onLevelChange(i, { label: e.target.value })}
              disabled={disabled}
              maxLength={50}
              placeholder="Label"
              className={`${inputClass} mb-2`}
            />
            <textarea
              value={l.description}
              onChange={(e) =>
                onLevelChange(i, { description: e.target.value })
              }
              disabled={disabled}
              rows={2}
              maxLength={500}
              placeholder="What this level looks like."
              className={`${inputClass} text-xs`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700 text-sm";
