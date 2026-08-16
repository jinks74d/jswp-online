"use client";

/**
 * Topic-Sentence-Development orchestrator. Per-BP tabs + reference
 * panel + Continue gate.
 *
 * Continue gate: each BP's sheet must have ≥1 selected candidate AND
 * that candidate must have a side tag. Rationale: the printed guide
 * uses the pro/con tally to choose direction; without a tag, there's
 * no signal to derive direction from. Names the offending BP.
 *
 * Tabs, layout and footer come from StepShell.
 */

import { TsdBpPane } from "./tsd-bp-pane";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { StepShell, type StepGate } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  sheets: readonly GatheringSheetData[];
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

function computeGate(sheets: readonly GatheringSheetData[]): StepGate {
  for (const sheet of sheets) {
    const tagged = sheet.candidates.filter(
      (c) => c.is_selected && c.argumentation_side !== null
    );
    if (tagged.length === 0) {
      return {
        canContinue: false,
        message: `Body paragraph ${sheet.body_paragraph_position} needs at least one tagged candidate (For / Against / Neutral).`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each body paragraph has at least one tagged candidate.",
  };
}

export function TsdClient({
  writingId,
  stepKey,
  sheets,
  sources,
  annotations,
}: Props) {
  const { pending, error, run } = useServerAction();

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={sheets}
      itemKey={(sheet) => sheet.id}
      tabLabel={(sheet) => `Body ${sheet.body_paragraph_position}`}
      renderPane={(sheet) => (
        <TsdBpPane writingId={writingId} sheet={sheet} />
      )}
      emptyMessage="No gathering sheets yet. Go back to gather-cds first."
      gate={computeGate(sheets)}
      onContinue={() => run(() => completeStepAndAdvance(writingId, stepKey))}
      pending={pending}
      error={error}
      reference={
        sources.length > 0 ? (
          <ReferencePanel
            writingId={writingId}
            sources={sources}
            annotations={annotations}
          />
        ) : undefined
      }
    />
  );
}
