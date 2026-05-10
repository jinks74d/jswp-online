/**
 * Server entry for Narrative's Discovering the Topic step.
 *
 * Bootstraps body_paragraphs + t_charts (chunk creation is skipped
 * for Narrative inside bootstrapWritingStructure since narrative
 * mode has no chunks). Fetches t-chart data and hands it to the
 * client orchestrator.
 *
 * Reuses getTChartData from chunk 4.4 — the data shape is exactly
 * what we need (BPs + their t_chart rows including all narrative_*
 * fields). No new query module.
 */

import { bootstrapWritingStructure } from "@/lib/actions/writing-structure";
import { getTChartData } from "@/lib/queries/t-charts";
import { DiscoveryClient } from "@/components/student/writing/discovery/discovery-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
}

export async function DiscoveryStep({
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

      <DiscoveryClient writingId={writingId} stepKey={stepKey} bps={bps} />
    </div>
  );
}
