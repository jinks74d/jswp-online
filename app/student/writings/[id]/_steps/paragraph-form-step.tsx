/**
 * Server entry for the paragraph_form step (4 modes).
 *
 * Calls bootstrapParagraphForms (idempotent) to ensure one
 * paragraph_forms row per BP exists before the UI renders. Then
 * fetches the per-BP data tree (paragraph_form row + shaping context
 * + per-chunk shaping outputs + narrative WOW context) and hands
 * to the client orchestrator.
 */

import {
  bootstrapParagraphForms,
  syncParagraphForms,
} from "@/lib/actions/paragraph-form";
import { getParagraphFormData } from "@/lib/queries/paragraph-form";
import { ParagraphFormClient } from "@/components/student/writing/paragraph-form/paragraph-form-client";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  isTerminal: boolean;
  mode: Mode;
  hasCounterargument: boolean;
}

export async function ParagraphFormStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  isTerminal,
  mode,
  hasCounterargument,
}: Props) {
  await bootstrapParagraphForms(writingId);
  // Keep final_text in sync with the composed paragraph for any row the
  // student hasn't hand-edited (fixes the stale-seed "first and last CD"
  // bug). Runs before the read below so the render shows fresh text.
  await syncParagraphForms(writingId);
  const bps = await getParagraphFormData(writingId);

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

      <ParagraphFormClient
        writingId={writingId}
        stepKey={stepKey}
        isTerminal={isTerminal}
        mode={mode}
        hasCounterargument={hasCounterargument}
        bps={bps}
      />
    </div>
  );
}
