/**
 * Server entry for the Gather-CDs step. Bootstraps gathering_cds_sheets
 * (one per body_paragraph_position) on every visit, fetches the data,
 * and hands everything to the client orchestrator.
 *
 * The reference panel (source text + annotations) is conditional on
 * the assignment having source_text — Argumentation assignments without
 * source text will skip the reference column entirely (the step still
 * renders; just no reference). Narrative skips this step at the engine
 * level (no gather-cds in NARRATIVE_STEPS).
 */

import { bootstrapGatheringSheets } from "@/lib/actions/candidate-cds";
import { getGatheringSheetsAndCandidates } from "@/lib/queries/candidate-cds";
import { getAnnotations } from "@/lib/queries/text-annotations";
import { GatherCdsClient } from "@/components/student/writing/gather-cds/gather-cds-client";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

export async function GatherCdsStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  sourceText,
  sourceTitle,
  sourceAuthor,
}: Props) {
  // Idempotent: safe to call on every visit. Race-safe via UNIQUE
  // (student_writing_id, body_paragraph_position) + ignoreDuplicates.
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

      <GatherCdsClient
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
