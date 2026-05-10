/**
 * Server entry for Literary's Making Decisions step. Reuses the same
 * commentary query as cm-dev (the data shape is identical — words +
 * is_best_word_* flags). No bootstrap call needed: by the time a
 * student reaches this step, cm-dev has already triggered the
 * structural bootstrap.
 */

import { getCommentaryByWriting } from "@/lib/queries/commentary";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { DecisionsClient } from "@/components/student/writing/decisions/decisions-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function DecisionsStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
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

      <DecisionsClient
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
