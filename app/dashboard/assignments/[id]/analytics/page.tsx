/**
 * /dashboard/assignments/[id]/analytics — teacher analytics surface.
 *
 * Server component. requireRole gates teacher/admin scope (same as
 * the rest of the dashboard). The analytics query is RLS-scoped so a
 * teacher who doesn't own the assignment gets the not_found branch.
 *
 * Three states:
 *   - not_found: notFound() — assignment doesn't exist or invisible.
 *   - no_class_period: assignment exists but isn't assigned to a class
 *     period yet. Render the "Assign a class" empty state.
 *   - ok: render the four analytics cards.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAssignmentForTeacher } from "@/lib/queries/assignments";
import { getAssignmentAnalytics } from "@/lib/queries/assignment-analytics";
import { SubmissionRateCard } from "@/components/dashboard/analytics/submission-rate-card";
import { ScoreDistribution } from "@/components/dashboard/analytics/score-distribution";
import { CriterionBreakdown } from "@/components/dashboard/analytics/criterion-breakdown";
import { InterventionCandidates } from "@/components/dashboard/analytics/intervention-candidates";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AssignmentAnalyticsPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);
  const { id } = await params;

  const assignment = await getAssignmentForTeacher(id, profile.id);
  if (!assignment) notFound();

  const result = await getAssignmentAnalytics(id);

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
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-2">
          <BarChart3 className="w-3.5 h-3.5" />
          Analytics
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {assignment.title || "(untitled)"}
        </h1>
      </header>

      {result.state === "not_found" ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
          Couldn&apos;t load analytics for this assignment.
        </div>
      ) : result.state === "no_class_period" ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Assign a class to see analytics
          </h2>
          <p className="text-sm text-gray-600">
            This assignment isn&apos;t attached to a class period yet.
            Edit the assignment and pick a class period — students will
            then be able to start writing, and the analytics surface
            will populate as they progress.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SubmissionRateCard
            enrolledCount={result.data.enrolledCount}
            submissionRate={result.data.submissionRate}
            formerWithSubmissions={result.data.formerWithSubmissions}
          />
          <ScoreDistribution stats={result.data.scoreStats} />
          <CriterionBreakdown
            hasRubric={result.data.hasRubric}
            breakdown={result.data.criterionBreakdown}
          />
          <InterventionCandidates
            candidates={result.data.interventionCandidates}
          />
        </div>
      )}
    </div>
  );
}
