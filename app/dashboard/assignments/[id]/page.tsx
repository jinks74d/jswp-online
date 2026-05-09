/**
 * /dashboard/assignments/[id] — load the draft (or published) assignment
 * and render the same shared form pre-filled. notFound() if the
 * assignment isn't theirs (RLS returns null).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getAssignmentForTeacher,
  getStudentWritingCount,
  getTeacherClassPeriodsForPicker,
  isPublished,
} from "@/lib/queries/assignments";
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
  const published = isPublished(assignment);

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

      <AssignmentForm
        formMode="edit"
        mode={assignment.mode}
        initial={assignment}
        classPeriods={classPeriods}
        schoolId={profile.school_id!}
        studentWritingCount={studentWritingCount}
      />
    </div>
  );
}
