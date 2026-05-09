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
import { ArrowLeft } from "lucide-react";
import { StepSidebar } from "./step-sidebar";
import type { StepConfig } from "@/lib/jswp-modes";

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
