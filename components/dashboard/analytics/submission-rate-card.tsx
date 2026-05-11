/**
 * Submission rate card (chunk 5.2).
 *
 * Headline: X / Y submitted with percentage.
 * Breakdown: status pills (Not started / Draft / In progress /
 * Submitted / Returned / Graded). Pill colors match the rest of the
 * dashboard.
 */

import type { AssignmentAnalytics } from "@/lib/queries/assignment-analytics";

interface Props {
  enrolledCount: number;
  submissionRate: AssignmentAnalytics["submissionRate"];
  formerWithSubmissions: number;
}

export function SubmissionRateCard({
  enrolledCount,
  submissionRate,
  formerWithSubmissions,
}: Props) {
  const { submitted, total, statusBreakdown } = submissionRate;
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  const pills: ReadonlyArray<{
    label: string;
    count: number;
    className: string;
  }> = [
    {
      label: "Not started",
      count: statusBreakdown.notStarted,
      className: "bg-gray-100 text-gray-700",
    },
    {
      label: "Draft",
      count: statusBreakdown.draft,
      className: "bg-gray-100 text-gray-700",
    },
    {
      label: "In progress",
      count: statusBreakdown.inProgress,
      className: "bg-blue-50 text-blue-800",
    },
    {
      label: "Submitted",
      count: statusBreakdown.submitted,
      className: "bg-amber-50 text-amber-800",
    },
    {
      label: "Returned",
      count: statusBreakdown.returned,
      className: "bg-purple-50 text-purple-800",
    },
    {
      label: "Graded",
      count: statusBreakdown.graded,
      className: "bg-green-50 text-green-800",
    },
  ];

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Submission rate
        </h2>
      </header>

      {enrolledCount === 0 ? (
        <p className="text-sm text-gray-600">
          No students currently enrolled in this class period.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {submitted}
            </span>
            <span className="text-sm text-gray-600">/ {total} submitted</span>
            <span className="ml-2 text-sm font-medium text-gray-700">
              ({pct}%)
            </span>
          </div>

          <div className="mt-2 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>

          <ul className="mt-4 flex flex-wrap gap-2">
            {pills.map((p) => (
              <li
                key={p.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.className}`}
              >
                <span>{p.label}</span>
                <span className="font-semibold">{p.count}</span>
              </li>
            ))}
          </ul>

          {formerWithSubmissions > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              {formerWithSubmissions} former student
              {formerWithSubmissions === 1 ? "" : "s"} with submissions
              hidden from totals.
            </p>
          )}
        </>
      )}
    </section>
  );
}
