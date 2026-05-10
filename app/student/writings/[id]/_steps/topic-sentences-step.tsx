/**
 * Server entry for Narrative's Topic Sentences step.
 *
 * Bootstraps writing structure (idempotent — body_paragraphs and
 * t_charts already exist by the time a student reaches here, but
 * the call is cheap and defensive). Fetches t-chart data and hands
 * to the single-screen client.
 */

import { bootstrapWritingStructure } from "@/lib/actions/writing-structure";
import { getTChartData } from "@/lib/queries/t-charts";
import { TopicSentencesClient } from "@/components/student/writing/topic-sentences/topic-sentences-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
}

export async function TopicSentencesStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
}: Props) {
  await bootstrapWritingStructure(writingId);
  const bps = await getTChartData(writingId);

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

      <TopicSentencesClient writingId={writingId} stepKey={stepKey} bps={bps} />
    </div>
  );
}
