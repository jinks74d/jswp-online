"use client";

/**
 * Defensive [Skip step] button — used by annotate-text-step when the
 * assignment's source_text is null (a config/data bug). Advances
 * current_step WITHOUT writing step_progress, so the gradebook still
 * shows the step as uncompleted once the teacher restores the source.
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { advanceCurrentStep } from "@/lib/actions/student-writings";
import { useWritingMode } from "@/components/student/writing/use-writing-mode";

export function SkipStepButton({
  writingId,
  stepKey,
}: {
  writingId: string;
  stepKey: string;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      try {
        await advanceCurrentStep(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        console.error("SkipStepButton:", e);
      }
    });
  };

  if (isReadOnly) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-2 px-5 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60"
    >
      {pending && <Loader2 className="w-4 h-4 animate-spin" />}
      {pending ? "Skipping…" : "Skip step"}
    </button>
  );
}
