/**
 * Server entry for the Read-and-Annotate step. Loads the source text +
 * existing annotations and hands them to the client orchestrator.
 *
 * Defensive case: if source_text is null (shouldn't happen — the step
 * config has requiresSourceText: true and the step engine filters
 * accordingly), render an error panel with [Skip step] so the student
 * is never stuck on a broken step.
 */

import { Construction } from "lucide-react";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { AnnotateTextClient } from "@/components/student/writing/annotate-text-client";
import { SkipStepButton } from "./skip-step-button";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function AnnotateTextStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
  if (!sourceText) {
    return (
      <div className="space-y-5">
        <header>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {stepLabel}
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
        </header>
        <div className="bg-white border border-amber-300 rounded-lg p-8 text-center">
          <Construction className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            No source text on this assignment
          </h3>
          <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
            This step expects a source text but none is attached. Skip
            ahead — your teacher can fix the assignment, and you can come
            back later.
          </p>
          <div className="mt-5 flex justify-center">
            <SkipStepButton writingId={writingId} stepKey={stepKey} />
          </div>
        </div>
      </div>
    );
  }

  const annotations = await getAnnotations(writingId);

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
        {pedagogyHint && (
          <p className="mt-1 text-sm text-gray-600">{pedagogyHint}</p>
        )}
      </header>

      <AnnotateTextClient
        writingId={writingId}
        stepKey={stepKey}
        sourceText={sourceText}
        sourceTitle={sourceTitle}
        sourceAuthor={sourceAuthor}
        initialAnnotations={annotations}
      />
    </div>
  );
}
