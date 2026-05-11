/**
 * Criterion-weakness breakdown (chunk 5.2).
 *
 * Per-criterion avg score (over the rubric snapshot max), sorted
 * weakest-first so the most actionable items sit on top. Includes a
 * level-distribution row showing how many writings landed at each
 * level for that criterion.
 *
 * Empty states:
 *  - hasRubric=false: "this assignment doesn't use a rubric"
 *  - hasRubric=true, breakdown empty: "no graded writings yet"
 */

import type { AssignmentAnalytics } from "@/lib/queries/assignment-analytics";

interface Props {
  hasRubric: boolean;
  breakdown: AssignmentAnalytics["criterionBreakdown"];
}

export function CriterionBreakdown({ hasRubric, breakdown }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Criterion breakdown
        </h2>
        {hasRubric && breakdown.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Weakest criteria first. Based on most-recent graded draft per
            student.
          </p>
        )}
      </header>

      {!hasRubric ? (
        <p className="text-sm text-gray-600">
          This assignment doesn&apos;t use a rubric. Criterion breakdown
          not available.
        </p>
      ) : breakdown.length === 0 ? (
        <p className="text-sm text-gray-600">
          No graded writings yet — criterion data will appear once you
          score submissions.
        </p>
      ) : (
        <ul className="space-y-4">
          {breakdown.map((c) => {
            const ratio = c.maxScore > 0 ? c.avgScore / c.maxScore : 0;
            const pct = Math.round(ratio * 100);
            const barColor =
              pct >= 75
                ? "bg-green-600"
                : pct >= 50
                  ? "bg-blue-600"
                  : pct >= 25
                    ? "bg-amber-500"
                    : "bg-red-500";

            return (
              <li
                key={c.criterionName}
                className="border border-gray-200 rounded-md p-3"
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h3 className="text-sm font-medium text-gray-900">
                    {c.criterionName}
                  </h3>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">
                      {c.avgScore.toFixed(1)}
                    </span>
                    <span className="text-gray-500"> / {c.maxScore}</span>
                    <span className="text-gray-500 ml-1">({pct}%)</span>
                  </span>
                </div>

                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor}`}
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                </div>

                {c.levelDistribution.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {c.levelDistribution.map((l) => (
                      <li
                        key={l.label}
                        className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-50 rounded-full px-2 py-0.5"
                      >
                        <span>{l.label}</span>
                        <span className="font-semibold">{l.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
