/**
 * Per-student assignment list (chunk 5.3).
 *
 * Detailed rundown of every assignment in the viewing teacher's scope
 * for this student: title, mode, status, submission + graded
 * timestamps, score, link to the writing-review page when a writing
 * exists. Most-recent first by released_at (matches the assignments
 * list ordering elsewhere in the dashboard).
 *
 * Status pill colors match teacher-status-badge.tsx idioms.
 */

import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import type { StudentProgressAssignment } from "@/lib/queries/student-progress";
import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

const MODE_LABELS: Record<StudentProgressAssignment["mode"], string> = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary",
  narrative: "Narrative",
};

interface Props {
  assignments: readonly StudentProgressAssignment[];
}

export function AssignmentList({ assignments }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Assignments
        </h2>
        {assignments.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            All assignments you&apos;ve released that this student is in
            scope for. Most recent first.
          </p>
        )}
      </header>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-600">
          You haven&apos;t released any assignments to this student&apos;s
          class period yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
          {assignments.map((a) => (
            <li key={a.id}>
              <AssignmentRow assignment={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AssignmentRow({
  assignment,
}: {
  assignment: StudentProgressAssignment;
}) {
  const status = assignment.writingStatus;
  const showScore = status === "graded" && assignment.totalScore !== null;
  const pct =
    showScore && assignment.rubricMaxScore && assignment.rubricMaxScore > 0
      ? Math.round(
          ((assignment.totalScore as number) / assignment.rubricMaxScore) * 100
        )
      : null;

  const stamp =
    assignment.gradedAt ?? assignment.submittedAt ?? assignment.releasedAt;
  const stampLabel = assignment.gradedAt
    ? "Graded"
    : assignment.submittedAt
      ? "Submitted"
      : "Released";

  const body = (
    <div className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
          <FileText className="w-3.5 h-3.5" />
          {MODE_LABELS[assignment.mode]}
        </div>
        <div className="text-sm font-medium text-gray-900 truncate mt-0.5">
          {assignment.title || "(untitled)"}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          <StatusPill status={status} />
          {stamp && (
            <span className="ml-2 text-gray-500">
              {stampLabel} {formatDate(stamp)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {showScore && (
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900 tabular-nums">
              {assignment.totalScore}
              {assignment.rubricMaxScore !== null && (
                <span className="text-gray-500 font-normal">
                  {" "}
                  / {assignment.rubricMaxScore}
                </span>
              )}
            </div>
            {pct !== null && (
              <div className="text-xs text-gray-600">{pct}%</div>
            )}
          </div>
        )}
        {assignment.writingId && (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </div>
  );

  if (assignment.writingId) {
    return (
      <Link
        href={`/dashboard/assignments/${assignment.id}/writings/${assignment.writingId}`}
        className="block hover:bg-gray-50"
      >
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}

function StatusPill({ status }: { status: WritingStatus | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
        Not started
      </span>
    );
  }
  // 'draft' is the row's initial state right after Start Writing; until a
  // step is completed, status stays 'draft' even though the student is
  // actively working. Match the student-side deriveStatus and surface both
  // as "In progress" so the teacher sees the meaningful state.
  const displayKey: WritingStatus = status === "draft" ? "in_progress" : status;
  const map: Record<WritingStatus, string> = {
    draft: "bg-blue-50 text-blue-800",
    in_progress: "bg-blue-50 text-blue-800",
    submitted: "bg-amber-50 text-amber-800",
    returned: "bg-purple-50 text-purple-800",
    graded: "bg-green-50 text-green-800",
  };
  const labels: Record<WritingStatus, string> = {
    draft: "In progress",
    in_progress: "In progress",
    submitted: "Submitted",
    returned: "Returned",
    graded: "Graded",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${map[displayKey]}`}
    >
      {labels[displayKey]}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
