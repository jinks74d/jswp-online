/**
 * Server entry for the Read-and-Annotate step. Loads existing annotations
 * and hands them, with every attached source, to the client orchestrator.
 *
 * Defensive case: if there are no sources (shouldn't happen — the step
 * config has requiresSourceText and the step engine filters accordingly),
 * render an error panel with [Skip step] so the student is never stuck.
 */

import { Construction } from "lucide-react";
import { getAnnotations } from "@/lib/queries/text-annotations";
import {
  AnnotateTextClient,
  type AnnotateSource,
} from "@/components/student/writing/annotate-text-client";
import { SkipStepButton } from "./skip-step-button";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  required: boolean;
  sources: AnnotateSource[];
}

export async function AnnotateTextStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  required,
  sources,
}: Props) {
  if (sources.length === 0) {
    return (
      <div className="space-y-5">
        <header>
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
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
        {pedagogyHint && (
          <p className="mt-1 text-sm text-gray-600">{pedagogyHint}</p>
        )}
      </header>

      <AnnotateTextClient
        writingId={writingId}
        stepKey={stepKey}
        required={required}
        sources={sources}
        initialAnnotations={annotations}
      />
    </div>
  );
}
