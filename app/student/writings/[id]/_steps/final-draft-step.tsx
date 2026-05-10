/**
 * Server entry for the final-draft step (essay-only, all 4 modes).
 *
 * Bootstraps final_drafts (idempotent) and renders the client with
 * the assembly source pre-fetched. The student can edit full_text
 * directly OR click [Assemble from pieces] to concatenate their
 * intro + paragraphs + conclusion (server reads fresh, writes back).
 */

import { bootstrapFinalDraft } from "@/lib/actions/final-draft";
import { getFinalDraftData } from "@/lib/queries/final-draft";
import { FinalDraftClient } from "@/components/student/writing/final-draft/final-draft-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  isTerminal: boolean;
}

export async function FinalDraftStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  isTerminal,
}: Props) {
  await bootstrapFinalDraft(writingId);
  const { final_draft, assembly } = await getFinalDraftData(writingId);

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

      <FinalDraftClient
        writingId={writingId}
        stepKey={stepKey}
        isTerminal={isTerminal}
        finalDraft={final_draft}
        assembly={assembly}
      />
    </div>
  );
}
