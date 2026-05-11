/**
 * Per-criterion trends (chunk 5.3).
 *
 * One row per rubric criterion (aggregated across this teacher's
 * assignments by criterion_name string match). Within the row,
 * mini-bars sit chronologically left-to-right — one per assignment
 * where that criterion was scored. Sorted weakest-first (lowest
 * average percentage on top) to surface the most actionable info.
 *
 * Score values across assignments can come from different max_scores
 * (rubric edited mid-cohort). The chart normalizes to percentage so
 * the bars are comparable.
 *
 * Empty states:
 *  - student has no graded rubric assignments → "no rubric trend data
 *    yet" message.
 *  - student has graded assignments but none with rubrics → same.
 */

import type { StudentProgressCriterionTrend } from "@/lib/queries/student-progress";

interface Props {
  trends: readonly StudentProgressCriterionTrend[];
}

export function CriterionTrends({ trends }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Criterion trends
        </h2>
        {trends.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Weakest criteria on top. Bars are chronological — leftmost
            is the earliest graded assignment with that criterion.
          </p>
        )}
      </header>

      {trends.length === 0 ? (
        <p className="text-sm text-gray-600">
          No rubric-scored writings yet — once you grade an assignment
          with a rubric, per-criterion trends will appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {trends.map((trend) => (
            <li key={trend.criterionName}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {trend.criterionName}
                </h3>
                <span className="text-xs text-gray-700">
                  avg{" "}
                  <span className="font-semibold">
                    {trend.averagePercentage.toFixed(0)}%
                  </span>
                  <span className="text-gray-500">
                    {" "}
                    ({trend.dataPoints.length} writing
                    {trend.dataPoints.length === 1 ? "" : "s"})
                  </span>
                </span>
              </div>

              <ol className="flex items-end gap-1 h-12">
                {trend.dataPoints.map((dp) => {
                  const pct = Math.max(0, Math.min(100, dp.percentage));
                  const barColor = pickBarColor(pct);
                  const heightPx = Math.max(2, (pct / 100) * 48);
                  return (
                    <li
                      key={`${trend.criterionName}-${dp.assignmentId}`}
                      className="flex-1 min-w-0 flex items-end"
                      title={`${dp.assignmentTitle} — ${dp.score} / ${dp.maxScore} (${pct.toFixed(0)}%)`}
                    >
                      <div
                        className={`w-full rounded-t ${barColor}`}
                        style={{ height: `${heightPx}px` }}
                        aria-label={`${dp.assignmentTitle}: ${pct.toFixed(0)} percent`}
                      />
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function pickBarColor(pct: number): string {
  if (pct >= 75) return "bg-green-600";
  if (pct >= 50) return "bg-blue-600";
  if (pct >= 25) return "bg-amber-500";
  return "bg-red-500";
}
