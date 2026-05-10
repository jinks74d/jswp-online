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
  assignment,
  steps,
  currentStepKey,
  completedKeys,
  status,
  submittedAt,
  gradedAt,
  totalScore,
  feedbackCount,
  children,
}: {
  writingId: string;
  assignment: {
    id: string;
    title: string;
    mode: keyof typeof MODE_LABELS;
  };
  steps: readonly StepConfig[];
  currentStepKey: string | null;
  completedKeys: ReadonlySet<string>;
  status: WritingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  totalScore: number | null;
  feedbackCount: number;
  children: React.ReactNode;
}) {
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

      <StatusBanner
        status={status}
        submittedAt={submittedAt}
        gradedAt={gradedAt}
        totalScore={totalScore}
        feedbackCount={feedbackCount}
      />

      <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
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
  feedbackCount,
}: {
  status: WritingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  totalScore: number | null;
  feedbackCount: number;
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
          {feedbackCount === 1
            ? "1 feedback item to review"
            : `${feedbackCount} feedback items to review`}
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
