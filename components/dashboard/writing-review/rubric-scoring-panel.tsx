"use client";

/**
 * Teacher rubric-scoring composer (chunk 5.1).
 *
 * Mounted inline by review-actions.tsx when the assignment has a non-empty
 * rubric. Per-criterion radio cards (one per level). Live total in the
 * header. Confirm disabled until every criterion has a selection.
 *
 * Selections are useState-local until [Confirm grade] — closing the page
 * mid-scoring loses them. Atomic confirm is the design.
 */

import { useMemo, useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import {
  gradeWritingByRubric,
  type RubricScoreInput,
} from "@/lib/actions/rubric-grading";
import type { Rubric } from "@/lib/rubric";

interface Props {
  writingId: string;
  rubric: Rubric;
  initialSelections?: ReadonlyMap<string, number>;
  onClose: () => void;
  onError: (message: string | null) => void;
}

export function RubricScoringPanel({
  writingId,
  rubric,
  initialSelections,
  onClose,
  onError,
}: Props) {
  // criterion_id → selected level score
  const [selections, setSelections] = useState<Map<string, number>>(() => {
    return new Map(initialSelections ?? []);
  });
  const [pending, start] = useTransition();

  const maxTotal = useMemo(
    () =>
      rubric.criteria.reduce(
        (sum, c) =>
          sum + (c.levels.length > 0 ? Math.max(...c.levels.map((l) => l.score)) : 0),
        0
      ),
    [rubric]
  );

  const currentTotal = useMemo(() => {
    let total = 0;
    selections.forEach((score) => {
      total += score;
    });
    return total;
  }, [selections]);

  const allScored = selections.size === rubric.criteria.length;

  const select = (criterionId: string, score: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(criterionId, score);
      return next;
    });
  };

  const submit = () => {
    onError(null);
    if (!allScored) {
      onError("Score every criterion before confirming.");
      return;
    }

    const payload: RubricScoreInput[] = rubric.criteria.map((c) => {
      const score = selections.get(c.id);
      const level = c.levels.find((l) => l.score === score) ?? null;
      const maxLevel = c.levels.reduce(
        (best, l) => (l.score > best.score ? l : best),
        c.levels[0]
      );
      return {
        criterion_id: c.id,
        criterion_name: c.name,
        max_score: maxLevel.score,
        score: score ?? 0,
        level_label: level?.label ?? null,
      };
    });

    start(async () => {
      try {
        await gradeWritingByRubric(writingId, payload);
        onClose();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not save grade.");
      }
    });
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Rubric grade</h3>
        <div className="text-sm text-gray-700">
          Total:{" "}
          <span className="font-semibold text-gray-900">{currentTotal}</span>
          <span className="text-gray-500"> / {maxTotal}</span>
        </div>
      </div>

      <div className="space-y-4">
        {rubric.criteria.map((criterion) => {
          const selected = selections.get(criterion.id);
          // Sort levels score-desc so "Exemplary" sits on the left.
          const orderedLevels = [...criterion.levels].sort(
            (a, b) => b.score - a.score
          );
          return (
            <fieldset
              key={criterion.id}
              className="border border-gray-200 rounded-md p-3"
            >
              <legend className="px-1 text-sm font-medium text-gray-900">
                {criterion.name}
              </legend>
              {criterion.description && (
                <p className="text-xs text-gray-600 mb-2">
                  {criterion.description}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {orderedLevels.map((level) => {
                  const isSelected = selected === level.score;
                  return (
                    <label
                      key={`${criterion.id}-${level.score}`}
                      className={`flex flex-col gap-1 cursor-pointer rounded-md border p-2 text-left transition-colors ${
                        isSelected
                          ? "border-green-600 bg-green-50"
                          : "border-gray-200 bg-white hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`criterion-${criterion.id}`}
                        value={level.score}
                        checked={isSelected}
                        onChange={() => select(criterion.id, level.score)}
                        disabled={pending}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? "text-green-800" : "text-gray-800"
                          }`}
                        >
                          {level.label}
                        </span>
                        <span
                          className={`text-xs ${
                            isSelected ? "text-green-700" : "text-gray-600"
                          }`}
                        >
                          {level.score}
                        </span>
                      </div>
                      {level.description && (
                        <span
                          className={`text-xs ${
                            isSelected ? "text-green-900" : "text-gray-700"
                          }`}
                        >
                          {level.description}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !allScored}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {pending ? "Saving…" : "Confirm grade"}
        </button>
      </div>
    </div>
  );
}
