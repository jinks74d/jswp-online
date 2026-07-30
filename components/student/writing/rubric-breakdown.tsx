/**
 * Student-facing rubric breakdown (chunk 5.1).
 *
 * Read-only display rendered below the "Graded" StatusBanner in WritingShell
 * when the writing has rubric_scores. Each row shows the criterion name, the
 * selected level label, and score / max. Snapshot fields drive the display —
 * if the rubric was edited after grading, the historical scores still render
 * accurately.
 *
 * Server component (no "use client") — purely presentational.
 */

import type { RubricScoreRow } from "@/lib/queries/rubric-scores";

interface Props {
  scores: ReadonlyArray<RubricScoreRow>;
}

export function RubricBreakdown({ scores }: Props) {
  if (scores.length === 0) return null;

  const total = scores.reduce((sum, s) => sum + Number(s.score), 0);
  const max = scores.reduce((sum, s) => sum + Number(s.max_score), 0);

  return (
    <section
      aria-label="Rubric breakdown"
      className="rounded-lg border border-green-200 bg-white p-4"
    >
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Rubric breakdown
        </h2>
        <div className="text-sm text-gray-700">
          Total:{" "}
          <span className="font-semibold text-gray-900">{total}</span>
          <span className="text-gray-500"> / {max}</span>
        </div>
      </header>
      <ul className="divide-y divide-gray-100">
        {scores.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-baseline justify-between gap-2 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {s.criterion_name}
              </div>
              {s.level_label && (
                <div className="text-xs text-gray-600">{s.level_label}</div>
              )}
            </div>
            <div className="text-sm text-gray-800">
              <span className="font-semibold">{s.score}</span>
              <span className="text-gray-500"> / {s.max_score}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
