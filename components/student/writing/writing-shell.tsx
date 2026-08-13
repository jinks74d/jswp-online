/**
 * Server-rendered chrome for the student writing flow. Layout is:
 *   [back-link to assignment detail]
 *   [assignment title + mode]
 *   [step sidebar (mobile: top accordion; desktop: left rail)] | [step content]
 *
 * No "use client" — this is pure layout. The interactive bits live
 * inside the children (the step components themselves) and the step
 * sidebar (which is its own client component).
 */

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Award, MessageSquare } from "lucide-react";
import { StepSidebar } from "./step-sidebar";
import { RubricBreakdown } from "./rubric-breakdown";
import { FeedbackPanel } from "@/components/dashboard/writing-review/feedback-panel";
import { formatGradeLabel, type GradeFormat } from "@/lib/grade-format";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";
import type { RubricScoreRow } from "@/lib/queries/rubric-scores";
import type { StepConfig } from "@/lib/jswp-modes";
import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

const MODE_LABELS = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary Analysis",
  narrative: "Narrative",
} as const;

export function WritingShell({
  writingId,
  currentUserId,
  assignment,
  steps,
  currentStepKey,
  completedKeys,
  status,
  submittedAt,
  gradedAt,
  totalScore,
  feedback,
  rubricScores,
  gradeFormat,
  overallGrade,
  children,
}: {
  writingId: string;
  currentUserId: string;
  assignment: {
    id: string;
    title: string;
    prompt: string;
    mode: keyof typeof MODE_LABELS;
  };
  steps: readonly StepConfig[];
  currentStepKey: string | null;
  completedKeys: ReadonlySet<string>;
  status: WritingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  totalScore: number | null;
  feedback: readonly FeedbackItemRow[];
  rubricScores: readonly RubricScoreRow[];
  gradeFormat: GradeFormat;
  overallGrade: string | null;
  children: React.ReactNode;
}) {
  const unresolvedCount = feedback.filter((f) => !f.is_resolved).length;
  // Show feedback panel only when there's any feedback at all on a
  // returned writing. Resolved-only state still surfaces (collapsed
  // section); pure-empty doesn't render the column.
  const showFeedbackColumn = feedback.length > 0;

  const overallGradeLabel =
    (status === "returned" || status === "graded") && gradeFormat !== "none"
      ? formatGradeLabel(gradeFormat, overallGrade ?? "")
      : "";

  // Feedback now lives in a full-width collapsible above the grid (below),
  // so the step content always gets the 2-column layout — no right rail.
  const gridClass = "grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]";

  return (
    <div className="space-y-4">
      <Link
        href={`/student/assignments/${assignment.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to assignment
      </Link>

      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {MODE_LABELS[assignment.mode]}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
      </header>

      {/* The prompt rides at the top of every step so the student never loses
          sight of what they're writing about. */}
      {assignment.prompt.trim() && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Prompt
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">
            {assignment.prompt}
          </p>
        </section>
      )}

      <StatusBanner
        status={status}
        submittedAt={submittedAt}
        gradedAt={gradedAt}
        totalScore={totalScore}
        unresolvedCount={unresolvedCount}
      />

      {overallGradeLabel && (
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-stone-700">
            Overall grade
          </span>
          <span className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-0.5 text-sm font-semibold text-stone-800">
            {overallGradeLabel}
          </span>
        </div>
      )}

      {status === "graded" && rubricScores.length > 0 && (
        <RubricBreakdown scores={rubricScores} />
      )}

      {showFeedbackColumn && (
        <details
          open
          className="group rounded-lg border border-gray-200 bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageSquare className="h-4 w-4 text-gray-700" />
              Teacher feedback
              <span className="text-xs font-normal text-gray-500">
                ({unresolvedCount} to review)
              </span>
            </span>
            <span className="text-xs text-gray-500 group-open:hidden">Show</span>
            <span className="hidden text-xs text-gray-500 group-open:inline">
              Hide
            </span>
          </summary>
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <FeedbackPanel
              writingId={writingId}
              feedback={feedback}
              mode="student"
              currentUserId={currentUserId}
              hideHeader
            />
          </div>
        </details>
      )}

      <div className={gridClass}>
        <StepSidebar
          writingId={writingId}
          steps={steps}
          currentStepKey={currentStepKey}
          completedKeys={completedKeys}
        />

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  submittedAt,
  gradedAt,
  totalScore,
  unresolvedCount,
}: {
  status: WritingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  totalScore: number | null;
  unresolvedCount: number;
}) {
  if (status === "draft" || status === "in_progress") {
    return null;
  }

  if (status === "submitted") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <div>
          <span className="font-medium">
            Submitted{submittedAt ? ` on ${formatDate(submittedAt)}` : ""}
          </span>
          <span className="text-amber-800"> · awaiting feedback</span>
        </div>
      </div>
    );
  }

  if (status === "graded") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        <Award className="w-5 h-5 flex-shrink-0 text-green-600" />
        <div>
          <span className="font-medium">Graded</span>
          {totalScore !== null && (
            <span className="text-green-800"> — score: {totalScore}</span>
          )}
          {gradedAt && (
            <span className="text-green-800/80 text-xs ml-2">
              ({formatDate(gradedAt)})
            </span>
          )}
        </div>
      </div>
    );
  }

  // returned
  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <MessageSquare className="w-5 h-5 flex-shrink-0 text-blue-600" />
      <div>
        <span className="font-medium">Returned for revision</span>
        <span className="text-blue-800">
          {" · "}
          {unresolvedCount === 0
            ? "All feedback addressed — re-submit when ready"
            : unresolvedCount === 1
              ? "1 feedback item to review"
              : `${unresolvedCount} feedback items to review`}
        </span>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
