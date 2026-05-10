/**
 * Server entry for the thesis step (essay-only, expository /
 * argumentation / literary; narrative has no thesis step).
 *
 * Bootstraps essay_parts (idempotent) and renders the shared
 * <EssayPartForm> with thesis_frame dropdown + thesis_text textarea.
 */

import { bootstrapEssayParts, updateThesisFields } from "@/lib/actions/essay-parts";
import { getEssayParts } from "@/lib/queries/essay-parts";
import {
  EssayPartForm,
  type SelectOption,
} from "@/components/student/writing/essay-parts/essay-part-form";
import type { Database } from "@/lib/database.types";

type ThesisFrame = Database["public"]["Enums"]["jswp_thesis_frame"];

const THESIS_FRAME_OPTIONS: ReadonlyArray<SelectOption> = [
  {
    value: "open",
    label: "Open",
    description:
      "A general statement. e.g., 'Schools have the greatest impact on a child's development.'",
  },
  {
    value: "framed_but",
    label: "Framed (but)",
    description: "X, but Y. — acknowledge, then pivot.",
  },
  {
    value: "framed_although",
    label: "Framed (although)",
    description: "Although X, Y; however, Z. — concede, assert, qualify.",
  },
  {
    value: "three_pronged",
    label: "Three-pronged",
    description: "…by A, B, and C. — three reasons in parallel.",
  },
];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
}

export async function ThesisStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
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

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
      </header>

      <EssayPartForm<ThesisFrame>
        writingId={writingId}
        stepKey={stepKey}
        pedagogyHint={pedagogyHint}
        textareaLabel="Thesis statement"
        textareaHelp="The single sentence that frames your essay."
        textareaRows={3}
        initialText={parts.thesis_text ?? ""}
        kindSelect={{
          label: "Thesis frame",
          help: "Which structure fits your argument best?",
          options: THESIS_FRAME_OPTIONS,
          initialValue: parts.thesis_frame,
          onSave: async (thesis_frame) => {
            await updateThesisFields(writingId, parts.id, { thesis_frame });
          },
        }}
        onTextSave={async (thesis_text) => {
          await updateThesisFields(writingId, parts.id, { thesis_text });
        }}
      />
    </div>
  );
}
