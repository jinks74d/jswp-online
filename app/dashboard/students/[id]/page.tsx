/**
 * /dashboard/students/[id] — single student detail + progress (chunk 5.3).
 *
 * Header: name, email, enrollment summary line.
 * Cards: grade, SIS ID, enrolled-in-your-classes list.
 * Progress sections:
 *   - Score timeline (chronological % bars over graded assignments)
 *   - Criterion trends (per-criterion mini-timelines, weakest first)
 *   - Assignment list (all assignments in scope, status pills, scores)
 *
 * Scoping: getStudentDetail + getStudentProgress both intersect the
 * viewing teacher's class periods with the student's enrollments.
 * Outside-of-scope students 404.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStudentDetail } from "@/lib/queries/students";
import { getStudentProgress } from "@/lib/queries/student-progress";
import { ScoreTimeline } from "@/components/dashboard/students/score-timeline";
import { CriterionTrends } from "@/components/dashboard/students/criterion-trends";
import { AssignmentList } from "@/components/dashboard/students/assignment-list";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function StudentDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const teacher = await requireUser();
  const student = await getStudentDetail(id, teacher.id);

  if (!student) notFound();

  const progress = await getStudentProgress(id, teacher.id);

  const displayName =
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    student.email ||
    "—";

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/students"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to My Students
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <p className="text-gray-600">{student.email ?? "—"}</p>
        {progress.state === "ok" && (
          <ProgressSummaryLine
            totalAssignments={progress.data.summary.totalAssignments}
            gradedCount={progress.data.summary.gradedCount}
            averagePercentage={progress.data.summary.averagePercentage}
          />
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard label="Grade" value={student.grade_level ?? "—"} />
        <DetailCard
          label="SIS ID"
          value={student.student_id_external ?? "—"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">
          Enrolled in your classes
        </h2>
        <ul className="space-y-2">
          {student.enrollments.map((e) => (
            <li
              key={e.class_period_id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <Link
                href={`/dashboard/classes/${e.class_period_id}`}
                className="block group"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {e.subjectName}
                </div>
                <div className="font-medium text-gray-900 group-hover:text-blue-700">
                  {e.className}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {e.period_label}
                  {e.academic_year ? ` · ${e.academic_year}` : ""}
                  {" · "}
                  {e.schoolName}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {progress.state === "ok" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ScoreTimeline points={progress.data.timeline} />
          <CriterionTrends trends={progress.data.criterionTrends} />
          <div className="lg:col-span-2">
            <AssignmentList assignments={progress.data.assignments} />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function ProgressSummaryLine({
  totalAssignments,
  gradedCount,
  averagePercentage,
}: {
  totalAssignments: number;
  gradedCount: number;
  averagePercentage: number | null;
}) {
  if (totalAssignments === 0) {
    return (
      <p className="text-sm text-gray-500">
        No assignments released to this student&apos;s class period yet.
      </p>
    );
  }
  const parts = [
    `${totalAssignments} assignment${totalAssignments === 1 ? "" : "s"} seen`,
    `${gradedCount} graded`,
  ];
  if (averagePercentage !== null) {
    parts.push(`avg ${averagePercentage.toFixed(0)}%`);
  }
  return <p className="text-sm text-gray-500">{parts.join(" · ")}</p>;
}
