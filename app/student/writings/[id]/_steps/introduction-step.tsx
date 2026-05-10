/**
 * Server entry for the introduction step (essay-only, all 4 modes).
 *
 * Bootstraps essay_parts (idempotent) and renders the shared
 * <EssayPartForm> with hook_kind dropdown + introduction_text
 * textarea. For non-narrative modes, the existing thesis_text is
 * shown as read-only context above the textarea (narrative has no
 * thesis step, so thesisContext is omitted).
 */

import {
  bootstrapEssayParts,
  updateIntroductionFields,
} from "@/lib/actions/essay-parts";
import { getEssayParts } from "@/lib/queries/essay-parts";
import {
  EssayPartForm,
  type SelectOption,
} from "@/components/student/writing/essay-parts/essay-part-form";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

const HOOK_KIND_OPTIONS: ReadonlyArray<SelectOption> = [
  {
    value: "anecdote",
    label: "Anecdote",
    description: "A short personal or illustrative story.",
  },
  {
    value: "rhetorical_question",
    label: "Rhetorical question",
    description: "A question with an obvious answer that draws the reader in.",
  },
  {
    value: "startling_fact",
    label: "Startling fact",
    description: "A surprising statistic or claim that demands attention.",
  },
  {
    value: "dialogue",
    label: "Dialogue",
    description: "Spoken words that drop the reader into the moment.",
  },
  {
    value: "famous_quote",
    label: "Famous quote",
    description: "A well-known line that frames your subject.",
  },
  {
    value: "internal_monologue",
    label: "Internal monologue",
    description: "Your own thoughts, lived from the inside.",
  },
];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  mode: Mode;
}

export async function IntroductionStep({
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

  // Narrative has no thesis step; skip the thesis context.
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
        textareaLabel="Introduction"
        textareaHelp="Open with your hook. Set up the subject. End with your thesis (if you have one)."
        textareaRows={8}
        initialText={parts.introduction_text ?? ""}
        thesisContext={thesisContext}
        kindSelect={{
          label: "Hook type",
          help: "Which kind of opening will pull the reader in?",
          options: HOOK_KIND_OPTIONS,
          initialValue: parts.introduction_hook_kind,
          onSave: async (introduction_hook_kind) => {
            await updateIntroductionFields(writingId, parts.id, {
              introduction_hook_kind,
            });
          },
        }}
        onTextSave={async (introduction_text) => {
          await updateIntroductionFields(writingId, parts.id, {
            introduction_text,
          });
        }}
      />
    </div>
  );
}
