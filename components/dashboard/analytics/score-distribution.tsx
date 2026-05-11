/**
 * Score distribution (chunk 5.2).
 *
 * Summary stats (mean / median / min / max) above a 4-bucket histogram.
 * Buckets are labeled by JSWP tier with the percentage range as
 * secondary text. CSS bars only — no chart library.
 *
 * Empty state when no graded writings.
 */

import type { AssignmentAnalytics } from "@/lib/queries/assignment-analytics";

interface Props {
  stats: AssignmentAnalytics["scoreStats"];
}

const TIER_COLORS: Record<string, string> = {
  Exemplary: "bg-green-600",
  Proficient: "bg-blue-600",
  Developing: "bg-amber-500",
  Beginning: "bg-red-500",
};

export function ScoreDistribution({ stats }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Score distribution
        </h2>
        {stats.rubricMax !== null && (
          <span className="text-xs text-gray-500">
            out of {stats.rubricMax}
          </span>
        )}
      </header>

      {stats.count === 0 ? (
        <p className="text-sm text-gray-600">
          No graded writings yet — score distribution will appear once
          you grade submissions.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Mean" value={formatNumber(stats.mean)} />
            <Stat label="Median" value={formatNumber(stats.median)} />
            <Stat label="Min" value={formatNumber(stats.min)} />
            <Stat label="Max" value={formatNumber(stats.max)} />
          </dl>

          <ul className="space-y-2">
            {stats.distribution.map((bucket) => {
              const pctOfClass =
                stats.count > 0 ? (bucket.count / stats.count) * 100 : 0;
              return (
                <li key={bucket.tier} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {bucket.tier}
                    </div>
                    <div className="text-xs text-gray-500">
                      {bucket.percentRange[0]}–{bucket.percentRange[1]}%
                    </div>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        TIER_COLORS[bucket.tier] ?? "bg-gray-400"
                      }`}
                      style={{ width: `${pctOfClass}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-sm text-gray-800 text-right tabular-nums">
                    {bucket.count}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-gray-500">
            Based on {stats.count} graded writing
            {stats.count === 1 ? "" : "s"} (most recent draft per student).
          </p>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
