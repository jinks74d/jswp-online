/**
 * Server entry for the T-chart step. Bootstraps body_paragraphs +
 * t_charts (+ chunks for CD/CM modes) on every visit (idempotent),
 * fetches the resulting data tree, and hands everything to the
 * client orchestrator.
 *
 * Reference panel data (source_text + annotations) is loaded only
 * when the assignment has source_text — narrative assignments
 * skip it entirely, expository/argumentation/literary include it.
 */

import { bootstrapWritingStructure } from "@/lib/actions/writing-structure";
import { getTChartData } from "@/lib/queries/t-charts";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { TChartClient } from "@/components/student/writing/t-chart/t-chart-client";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  mode: Mode;
  chunkRatio: ChunkRatio;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function TChartStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  mode,
  chunkRatio,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
  // Bootstrap is idempotent: safe to call on every visit. Concurrent
  // tabs racing through this won't create duplicates — see the
  // UNIQUE constraints + ignoreDuplicates upserts in the action.
  await bootstrapWritingStructure(writingId);

  const [data, annotations] = await Promise.all([
    getTChartData(writingId),
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

      <TChartClient
        writingId={writingId}
        stepKey={stepKey}
        mode={mode}
        writingChunkRatio={chunkRatio}
        bodyParagraphs={data}
        sourceText={sourceText}
        sourceTitle={sourceTitle}
        sourceAuthor={sourceAuthor}
        annotations={annotations}
      />
    </div>
  );
}
