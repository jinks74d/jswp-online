/**
 * Server entry for Literary's Generating Commentary (cm_dev) step.
 *
 * Calls the shared writing-structure bootstrap on every visit. For
 * Literary mode the bootstrap creates 5 starter kind='word' slots
 * per CD (positions 1..5) alongside the existing 2 sentence-CMs
 * (positions 6..7) — so by the time this UI renders, the student
 * has 5 empty slots ready to type into without any post-bootstrap
 * count check.
 *
 * Race-safe: the per-CD starter creation is downstream of a
 * UNIQUE-guarded chunk INSERT in the bootstrap. Two tabs racing here
 * see exactly 5 word slots, never 10.
 */

import { bootstrapWritingStructure } from "@/lib/actions/writing-structure";
import { getCommentaryByWriting } from "@/lib/queries/commentary";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { CmDevClient } from "@/components/student/writing/cm-dev/cm-dev-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function CmDevStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
  await bootstrapWritingStructure(writingId);

  const [bps, annotations] = await Promise.all([
    getCommentaryByWriting(writingId),
    sourceText ? getAnnotations(writingId) : Promise.resolve([]),
  ]);

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

      <CmDevClient
        writingId={writingId}
        stepKey={stepKey}
        bps={bps}
        sourceText={sourceText}
        sourceTitle={sourceTitle}
        sourceAuthor={sourceAuthor}
        annotations={annotations}
      />
    </div>
  );
}
