/**
 * Score timeline (chunk 5.3).
 *
 * One vertical bar per graded assignment, ordered chronologically by
 * graded_at (oldest left → newest right). Bar height = percentage of
 * known max. JSWP-tier coloring matches the 5.2 distribution histogram
 * (Beginning red → Exemplary green) for visual consistency.
 *
 * CSS bars only — no chart library. Hover for assignment title + score.
 */

import type { StudentProgressTimelinePoint } from "@/lib/queries/student-progress";

interface Props {
  points: readonly StudentProgressTimelinePoint[];
}

export function ScoreTimeline({ points }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Score timeline
        </h2>
        {points.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Oldest left, newest right. Each bar shows the score as a
            percentage of the assignment&apos;s max.
          </p>
        )}
      </header>

      {points.length === 0 ? (
        <p className="text-sm text-gray-600">
          No graded writings yet — once submissions are graded, the
          timeline will fill in chronologically.
        </p>
      ) : (
        <>
          <ol className="flex items-end gap-2 h-40 border-b border-gray-200 pb-1">
            {points.map((p) => {
              const pct = Math.max(0, Math.min(100, p.percentage));
              const barColor = pickBarColor(pct);
              const heightPx = Math.max(4, (pct / 100) * 144); // 144px chart area
              return (
                <li
                  key={`${p.assignmentId}-${p.gradedAt}`}
                  className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1"
                  title={`${p.assignmentTitle} — ${p.score} / ${p.maxScore} (${pct.toFixed(0)}%) on ${formatDate(p.gradedAt)}`}
                >
                  <span className="text-[10px] text-gray-600 tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                  <div
                    className={`w-full rounded-t ${barColor}`}
                    style={{ height: `${heightPx}px` }}
                    aria-label={`${p.assignmentTitle}: ${pct.toFixed(0)} percent`}
                  />
                </li>
              );
            })}
          </ol>

          <ol className="flex items-start gap-2 mt-2">
            {points.map((p) => (
              <li
                key={`${p.assignmentId}-${p.gradedAt}-label`}
                className="flex-1 min-w-0 text-[10px] text-gray-500 text-center truncate"
              >
                {formatDateShort(p.gradedAt)}
              </li>
            ))}
          </ol>

          <p className="mt-3 text-xs text-gray-500">
            {points.length} graded writing{points.length === 1 ? "" : "s"}.
          </p>
        </>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });
}
