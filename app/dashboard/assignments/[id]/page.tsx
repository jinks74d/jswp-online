import type { Metadata } from "next";
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
  getTeacherClassPeriodsForPicker,
  isPublished,
} from "@/lib/queries/assignments";
import {
  countAssignmentWritingsByStatus,
  countSubmittedStepsForAssignment,
} from "@/lib/queries/teacher-writings";
import { AssignmentForm } from "../assignment-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentDetailPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole(["teacher"]);
  const { id } = await params;

  const assignment = await getAssignmentForTeacher(id, profile.id);
  if (!assignment) notFound();

  // Independent reads — fire together rather than in series.
  const [classPeriods, writingCounts, submittedSteps] = await Promise.all([
    // The assignment's school, not the teacher's — a teacher who transferred
    // is still editing a row owned by the school it was created at.
    getTeacherClassPeriodsForPicker(profile.id, assignment.school_id),
    countAssignmentWritingsByStatus(assignment.id),
    // Steps flagged ready to grade. Invisible to the status counts above,
    // because submitting a step leaves the writing in progress.
    countSubmittedStepsForAssignment(assignment.id),
  ]);
  const stepsToGrade = [...submittedSteps.values()].reduce(
    (n, s) => n + s.count,
    0
  );
  const published = isPublished(assignment);
  // student_writings.status is NOT NULL over a 5-value enum and every value is
  // counted, so this sum is exactly getStudentWritingCount(assignment.id) —
  // derive it instead of paying for a second round trip to the same table.
  const totalWritings =
    writingCounts.draft +
    writingCounts.in_progress +
    writingCounts.submitted +
    writingCounts.returned +
    writingCounts.graded;
  const studentWritingCount = totalWritings;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/assignments"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Back to My Assignments
      </Link>

      <header>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              published
                ? "bg-green-100 text-green-800"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {published ? "Published" : "Draft"}
          </span>
          <span className="text-xs uppercase tracking-wide text-stone-600">
            {assignment.mode}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {assignment.title || "(untitled)"}
        </h1>
        {published && assignment.released_at && (
          <p className="text-xs text-stone-600 mt-1">
            Published {new Date(assignment.released_at).toLocaleString()}
          </p>
        )}
      </header>

      {published && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/dashboard/assignments/${assignment.id}/writings`}
            className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl shadow-sm px-4 py-3 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Inbox
                className="w-5 h-5 text-stone-700 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  Submissions
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {submissionsBlurb(writingCounts, totalWritings, stepsToGrade)}
                </div>
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              aria-hidden="true"
            />
          </Link>

          <Link
            href={`/dashboard/assignments/${assignment.id}/analytics`}
            className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl shadow-sm px-4 py-3 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3
                className="w-5 h-5 text-stone-700 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  Analytics
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  Submission rate, score distribution, and intervention
                  candidates.
                </div>
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              aria-hidden="true"
            />
          </Link>
        </div>
      )}

      <div id="edit" className="scroll-mt-6">
        <AssignmentForm
          formMode="edit"
          mode={assignment.mode}
          initial={assignment}
          classPeriods={classPeriods}
          // The ASSIGNMENT's school, not the teacher's current one. This drives
          // the storage prefix for rubric and source uploads (school-{uuid}/...),
          // which the 0003 bucket policies key off. For a teacher who has since
          // transferred, profile.school_id would upload rubrics into a folder
          // updateAssignment then rejects — it validates against the
          // assignment's school — leaving an error whose "re-select it and save
          // again" advice can never succeed. Source files have no such server
          // check, so they would instead land under a prefix the assignment's
          // own students cannot read.
          schoolId={assignment.school_id}
          teacherId={profile.id}
          studentWritingCount={studentWritingCount}
        />
      </div>
    </div>
  );
}

function submissionsBlurb(
  counts: Awaited<ReturnType<typeof countAssignmentWritingsByStatus>>,
  total: number,
  stepsToGrade: number
): string {
  if (total === 0) return "No student writings yet.";
  const parts: string[] = [];
  // Leads: individually submitted steps are the ones actively waiting on her,
  // and no status count reflects them.
  if (stepsToGrade > 0) {
    parts.push(`${stepsToGrade} step${stepsToGrade === 1 ? "" : "s"} to grade`);
  }
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
