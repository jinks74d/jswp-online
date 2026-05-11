/**
 * /dashboard/assignments/[id] — load the draft (or published) assignment
 * and render the same shared form pre-filled. notFound() if the
 * assignment isn't theirs (RLS returns null).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getAssignmentForTeacher,
  getStudentWritingCount,
  getTeacherClassPeriodsForPicker,
  isPublished,
} from "@/lib/queries/assignments";
import { countAssignmentWritingsByStatus } from "@/lib/queries/teacher-writings";
import {
  listPinnedForAssignment,
  listPinnableForTeacher,
} from "@/lib/queries/assignment-exemplars";
import { PinnedExemplarsList } from "@/components/dashboard/assignments/pinned-exemplars-list";
import { AssignmentForm } from "../assignment-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AssignmentDetailPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole(["teacher"]);
  const { id } = await params;

  const assignment = await getAssignmentForTeacher(id, profile.id);
  if (!assignment) notFound();

  const classPeriods = await getTeacherClassPeriodsForPicker(profile.id);
  const studentWritingCount = await getStudentWritingCount(assignment.id);
  const writingCounts = await countAssignmentWritingsByStatus(assignment.id);
  const [pinnedExemplars, pinnableExemplars] = await Promise.all([
    listPinnedForAssignment(assignment.id, profile.id),
    listPinnableForTeacher(profile.id, assignment.mode),
  ]);
  const published = isPublished(assignment);
  const totalWritings =
    writingCounts.draft +
    writingCounts.in_progress +
    writingCounts.submitted +
    writingCounts.returned +
    writingCounts.graded;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/assignments"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to My Assignments
      </Link>

      <header>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              published
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {published ? "Published" : "Draft"}
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-500">
            {assignment.mode}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {assignment.title || "(untitled)"}
        </h1>
        {published && assignment.released_at && (
          <p className="text-xs text-gray-500 mt-1">
            Published {new Date(assignment.released_at).toLocaleString()}
          </p>
        )}
      </header>

      {published && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/dashboard/assignments/${assignment.id}/writings`}
            className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Inbox className="w-5 h-5 text-gray-700 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  Submissions
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {submissionsBlurb(writingCounts, totalWritings)}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>

          <Link
            href={`/dashboard/assignments/${assignment.id}/analytics`}
            className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3 className="w-5 h-5 text-gray-700 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  Analytics
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Submission rate, score distribution, and intervention
                  candidates.
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
        </div>
      )}

      {published && <PinnedExemplarsList pinned={pinnedExemplars} />}

      <AssignmentForm
        formMode="edit"
        mode={assignment.mode}
        initial={assignment}
        classPeriods={classPeriods}
        schoolId={profile.school_id!}
        studentWritingCount={studentWritingCount}
        pinnedExemplars={pinnedExemplars}
        pinnableExemplars={pinnableExemplars}
      />
    </div>
  );
}

function submissionsBlurb(
  counts: Awaited<ReturnType<typeof countAssignmentWritingsByStatus>>,
  total: number
): string {
  if (total === 0) return "No student writings yet.";
  const parts: string[] = [];
  if (counts.submitted > 0) parts.push(`${counts.submitted} submitted`);
  if (counts.returned > 0) parts.push(`${counts.returned} returned`);
  if (counts.graded > 0) parts.push(`${counts.graded} graded`);
  if (counts.in_progress > 0)
    parts.push(`${counts.in_progress} in progress`);
  if (counts.draft > 0) parts.push(`${counts.draft} draft`);
  return parts.length > 0
    ? parts.join(" · ")
    : `${total} writing${total === 1 ? "" : "s"}`;
}
