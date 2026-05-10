/**
 * /dashboard/assignments/[id]/writings — list of every student
 * writing on this assignment, grouped by status. RLS-scoped via
 * the teacher's session (see student_writings_teacher_select).
 *
 * Sections in priority order: Submitted (most actionable) →
 * Returned → Graded → In Progress → Draft.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAssignmentForTeacher } from "@/lib/queries/assignments";
import { listAssignmentWritings } from "@/lib/queries/teacher-writings";
import { TeacherStatusBadge } from "@/components/dashboard/writing-review/teacher-status-badge";
import type { Database } from "@/lib/database.types";

type Status = Database["public"]["Enums"]["jswp_writing_status"];

export const dynamic = "force-dynamic";

const SECTION_ORDER: Status[] = [
  "submitted",
  "returned",
  "graded",
  "in_progress",
  "draft",
];

const SECTION_LABELS: Record<Status, string> = {
  submitted: "Submitted",
  returned: "Returned",
  graded: "Graded",
  in_progress: "In Progress",
  draft: "Draft",
};

type Params = Promise<{ id: string }>;

export default async function AssignmentWritingsPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole(["teacher", "school_admin", "district_admin", "super_admin"]);
  const { id } = await params;

  const assignment = await getAssignmentForTeacher(id, profile.id);
  if (!assignment) notFound();

  const writings = await listAssignmentWritings(id);
  const grouped: Record<Status, typeof writings> = {
    draft: [],
    in_progress: [],
    submitted: [],
    returned: [],
    graded: [],
  };
  for (const w of writings) grouped[w.status].push(w);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/assignments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to assignment
      </Link>

      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Submissions
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {assignment.title || "(untitled)"}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {writings.length} {writings.length === 1 ? "writing" : "writings"} from your students.
        </p>
      </header>

      {writings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {SECTION_ORDER.map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status} className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  {SECTION_LABELS[status]}
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({items.length})
                  </span>
                </h2>
                <div className="grid gap-2">
                  {items.map((w) => (
                    <WritingCard
                      key={w.id}
                      assignmentId={id}
                      writing={w}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WritingCard({
  assignmentId,
  writing,
}: {
  assignmentId: string;
  writing: Awaited<ReturnType<typeof listAssignmentWritings>>[number];
}) {
  const name =
    [writing.student.first_name, writing.student.last_name]
      .filter(Boolean)
      .join(" ") ||
    writing.student.email ||
    "—";

  const activity = activityLine(writing);

  return (
    <Link
      href={`/dashboard/assignments/${assignmentId}/writings/${writing.id}`}
      className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{name}</div>
        {activity && (
          <div className="text-xs text-gray-500 mt-0.5">{activity}</div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <TeacherStatusBadge status={writing.status} />
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </Link>
  );
}

function activityLine(
  writing: Awaited<ReturnType<typeof listAssignmentWritings>>[number]
): string | null {
  if (writing.status === "submitted" && writing.submitted_at) {
    return `Submitted ${formatRelative(writing.submitted_at)}`;
  }
  if (writing.status === "returned" && writing.returned_at) {
    return `Returned ${formatRelative(writing.returned_at)}`;
  }
  if (writing.status === "graded") {
    const score =
      writing.total_score !== null ? ` · score ${writing.total_score}` : "";
    return writing.graded_at
      ? `Graded ${formatRelative(writing.graded_at)}${score}`
      : `Graded${score}`;
  }
  return `Last edited ${formatRelative(writing.updated_at)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
      <FileText className="w-10 h-10 text-gray-400 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900">
        No submissions yet
      </h2>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
        Your students haven&apos;t started this assignment, or their writings
        haven&apos;t reached you yet. Check back later.
      </p>
    </div>
  );
}
