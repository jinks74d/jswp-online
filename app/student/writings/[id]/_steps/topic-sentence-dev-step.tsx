/**
 * Server entry for the Argumentation Topic-Sentence-Development step.
 *
 * Bootstraps the same gathering_cds_sheets the gather-cds step uses
 * (idempotent — no-op when sheets already exist), reads them, and
 * hands them to the TSD client. The student tags each selected
 * candidate with pro/con/neutral; the tags inform the next-step
 * t-chart's working topic sentence direction.
 *
 * Reference panel reuses the shared component from chunk 4.5.
 */

import { bootstrapGatheringSheets } from "@/lib/actions/candidate-cds";
import { getGatheringSheetsAndCandidates } from "@/lib/queries/candidate-cds";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { TsdClient } from "@/components/student/writing/topic-sentence-dev/tsd-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function TopicSentenceDevStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
  // Idempotent: bootstraps if the student arrived here via URL hack
  // without visiting gather-cds. Race-safe via UNIQUE constraint.
  await bootstrapGatheringSheets(writingId);

  const [sheets, annotations] = await Promise.all([
    getGatheringSheetsAndCandidates(writingId),
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

      <TsdClient
        writingId={writingId}
        stepKey={stepKey}
        sheets={sheets}
        sourceText={sourceText}
        sourceTitle={sourceTitle}
        sourceAuthor={sourceAuthor}
        annotations={annotations}
      />
    </div>
  );
}
