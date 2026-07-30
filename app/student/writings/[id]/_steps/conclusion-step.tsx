/**
 * Server entry for the conclusion step (essay-only, all 4 modes).
 *
 * Bootstraps essay_parts (idempotent) and renders the shared
 * <EssayPartForm> — just a textarea, no dropdown. For non-narrative
 * modes, thesis_text is shown above as read-only context (the
 * student typically restates the thesis here).
 */

import {
  bootstrapEssayParts,
  updateConclusionText,
} from "@/lib/actions/essay-parts";
import { getEssayParts } from "@/lib/queries/essay-parts";
import { EssayPartForm } from "@/components/student/writing/essay-parts/essay-part-form";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  mode: Mode;
}

export async function ConclusionStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  mode,
}: Props) {
  await bootstrapEssayParts(writingId);
  const parts = await getEssayParts(writingId);

  if (!parts) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Essay parts row not yet bootstrapped. Reload to retry.
      </div>
    );
  }

  const thesisContext = mode === "narrative" ? null : parts.thesis_text;

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
      </header>

      <EssayPartForm
        writingId={writingId}
        stepKey={stepKey}
        pedagogyHint={pedagogyHint}
        textareaLabel="Conclusion"
        textareaHelp={
          mode === "narrative"
            ? "End with the lesson, a feeling, or a finishing thought. Don't restate the introduction."
            : "Restate the thesis (don't repeat it). Broaden out. Provide a finished feeling."
        }
        textareaRows={8}
        initialText={parts.conclusion_text ?? ""}
        thesisContext={thesisContext}
        onTextSave={async (conclusion_text) => {
          await updateConclusionText(writingId, parts.id, conclusion_text);
        }}
      />
    </div>
  );
}
