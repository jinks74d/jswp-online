/**
 * Intervention candidates (chunk 5.2).
 *
 * Three groupings:
 *   - Not yet submitted (status in draft/in_progress, or no writing)
 *   - Awaiting grading (submitted/returned)
 *   - Scored below threshold (graded, total_score < 50% of max)
 *
 * Each student row links to /dashboard/students/[id]. Empty state when
 * all three sections are empty (i.e., every enrolled student has a
 * graded writing above the threshold).
 */

import Link from "next/link";
import { Clock, CircleAlert, ChevronRight } from "lucide-react";
import type {
  AssignmentAnalytics,
  StudentRef,
} from "@/lib/queries/assignment-analytics";

interface Props {
  candidates: AssignmentAnalytics["interventionCandidates"];
}

export function InterventionCandidates({ candidates }: Props) {
  const total =
    candidates.notSubmitted.length +
    candidates.awaitingGrading.length +
    candidates.belowThreshold.length;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Intervention candidates
        </h2>
        {total > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {total} student{total === 1 ? "" : "s"} flagged
          </p>
        )}
      </header>

      {total === 0 ? (
        <p className="text-sm text-gray-600">
          Nothing flagged — every enrolled student has a graded writing
          at or above 50% of max.
        </p>
      ) : (
        <div className="space-y-4">
          {candidates.notSubmitted.length > 0 && (
            <GroupBlock
              icon={<Clock className="w-4 h-4 text-gray-500" />}
              title="Not yet submitted"
              students={candidates.notSubmitted}
            />
          )}
          {candidates.awaitingGrading.length > 0 && (
            <GroupBlock
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              title="Awaiting grading"
              students={candidates.awaitingGrading}
            />
          )}
          {candidates.belowThreshold.length > 0 && (
            <ThresholdBlock
              icon={<CircleAlert className="w-4 h-4 text-red-600" />}
              title="Scored below 50% threshold"
              entries={candidates.belowThreshold}
            />
          )}
        </div>
      )}
    </section>
  );
}

function GroupBlock({
  icon,
  title,
  students,
}: {
  icon: React.ReactNode;
  title: string;
  students: readonly StudentRef[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-medium text-gray-900">
          {title}{" "}
          <span className="text-gray-500 font-normal">({students.length})</span>
        </h3>
      </div>
      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
        {students.map((s) => (
          <li key={s.id}>
            <Link
              href={`/dashboard/students/${s.id}`}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <span className="text-gray-900 truncate">
                {studentDisplayName(s)}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThresholdBlock({
  icon,
  title,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  entries: ReadonlyArray<{ student: StudentRef; score: number }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-medium text-gray-900">
          {title}{" "}
          <span className="text-gray-500 font-normal">({entries.length})</span>
        </h3>
      </div>
      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
        {entries.map((e) => (
          <li key={e.student.id}>
            <Link
              href={`/dashboard/students/${e.student.id}`}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <span className="text-gray-900 truncate">
                {studentDisplayName(e.student)}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-600 tabular-nums">
                  {e.score}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function studentDisplayName(s: StudentRef): string {
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  return name || s.email || "—";
}
