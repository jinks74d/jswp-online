"use client";

/**
 * Placeholder step — rendered for any step whose real UI hasn't shipped
 * yet. The [Continue] button advances current_step WITHOUT writing a
 * step_progress row (the student hasn't actually done the work). When
 * the real step lands in chunks 4.3-4.6, it'll mark itself complete
 * properly.
 */

import { useTransition } from "react";
import { Loader2, Construction } from "lucide-react";
import { advanceCurrentStep } from "@/lib/actions/student-writings";
import { useWritingMode } from "@/components/student/writing/use-writing-mode";

export function PlaceholderStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
}: {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, startTransition] = useTransition();

  const onContinue = () => {
    startTransition(async () => {
      try {
        await advanceCurrentStep(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        console.error("advanceCurrentStep:", e);
      }
    });
  };

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

      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <Construction className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">
          Coming soon
        </h3>
        <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
          This step&apos;s interface is still being built. For now,
          you can continue through the flow — your progress on earlier
          steps is saved.
        </p>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-wait"
            style={{ backgroundColor: "var(--district-primary)" }}
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending ? "Loading…" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
