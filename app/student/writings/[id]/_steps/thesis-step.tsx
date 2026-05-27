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
type Mode = Database["public"]["Enums"]["jswp_mode"];

// Argumentation / literary frames — the original concede/pivot set.
const DEFAULT_THESIS_FRAME_OPTIONS: ReadonlyArray<SelectOption> = [
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

// Expository framing (2024 Expository guide pp.117-118): "framed" names each
// body paragraph's topic; "open" doesn't. Reuses the `three_pronged` enum
// value as the framed option (names A, B, C) to stay migration-free.
// ⚠ PENDING DR. LOUIS — confirm labels/wording and whether expository wants a
// dedicated `framed` enum value (any paragraph count, not just three) before
// merge to master. See BACKLOG "confirm essay-frame wording."
const EXPOSITORY_THESIS_FRAME_OPTIONS: ReadonlyArray<SelectOption> = [
  {
    value: "open",
    label: "Open thesis",
    description:
      "Don't name the paragraph topics — a general statement of your point.",
  },
  {
    value: "three_pronged",
    label: "Framed thesis",
    description:
      "Name each body paragraph's topic in the thesis (e.g., by A, B, and C).",
  },
];

function thesisFrameOptions(mode: Mode): ReadonlyArray<SelectOption> {
  return mode === "expository"
    ? EXPOSITORY_THESIS_FRAME_OPTIONS
    : DEFAULT_THESIS_FRAME_OPTIONS;
}

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  mode: Mode;
}

export async function ThesisStep({
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

  const isExpository = mode === "expository";

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
      </header>

      {isExpository && <FlipThePromptHelper />}

      <EssayPartForm<ThesisFrame>
        writingId={writingId}
        stepKey={stepKey}
        pedagogyHint={pedagogyHint}
        textareaLabel="Thesis statement"
        textareaHelp={
          isExpository
            ? "One sentence: your subject + your explanation. Place it as the last sentence of your introduction."
            : "The single sentence that frames your essay."
        }
        textareaRows={3}
        initialText={parts.thesis_text ?? ""}
        kindSelect={{
          label: "Thesis frame",
          help: isExpository
            ? "Framed names each body paragraph's topic; open does not."
            : "Which structure fits your argument best?",
          options: thesisFrameOptions(mode),
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

/**
 * Beginner "Flip the Prompt" template for expository thesis statements
 * (2024 Expository guide pp.117-118). Static teaching copy, not stored.
 * ⚠ PENDING DR. LOUIS — confirm template + example wording before merge.
 */
function FlipThePromptHelper() {
  return (
    <details className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-gray-800">
        Need a starting point? Try “Flip the Prompt.”
      </summary>
      <div className="mt-2 space-y-1.5 text-gray-700">
        <p>
          Turn the prompt into a thesis by filling in this frame:
        </p>
        <p className="rounded bg-white border border-gray-200 px-2 py-1 font-mono text-xs">
          In &lt;Author&gt;&apos;s &ldquo;&lt;Title&gt;,&rdquo; &lt;subject&gt; &lt;your explanation&gt;.
        </p>
        <p className="text-xs text-gray-500">
          Example: In Kate Kinsella&apos;s &ldquo;When Women Rushed for Gold,&rdquo;
          two women of the Alaskan Gold Rush are known for their accomplishments.
        </p>
      </div>
    </details>
  );
}
