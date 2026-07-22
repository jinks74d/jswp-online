/**
 * Server entry for Literary's Elaboration step. Reuses
 * getCommentaryByWriting (same shape as cm-dev / decisions). No
 * bootstrap call needed — earlier steps have already run it.
 */

import { getCommentaryByWriting } from "@/lib/queries/commentary";
import { getAnnotations } from "@/lib/queries/text-annotations";
import type { ReferenceSource } from "@/components/student/writing/reference-panel";
import { ElaborationClient } from "@/components/student/writing/elaboration/elaboration-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sources: ReferenceSource[];
}

export async function ElaborationStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sources,
}: Props) {
  const [bps, annotations] = await Promise.all([
    getCommentaryByWriting(writingId),
    sources.length > 0 ? getAnnotations(writingId) : Promise.resolve([]),
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
        sources={sources}
        annotations={annotations}
      />
    </div>
  );
}
