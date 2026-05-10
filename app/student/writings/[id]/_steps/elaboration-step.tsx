/**
 * Server entry for Literary's Elaboration step. Reuses
 * getCommentaryByWriting (same shape as cm-dev / decisions). No
 * bootstrap call needed — earlier steps have already run it.
 */

import { getCommentaryByWriting } from "@/lib/queries/commentary";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { ElaborationClient } from "@/components/student/writing/elaboration/elaboration-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function ElaborationStep({
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

      <ElaborationClient
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
