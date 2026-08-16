"use client";

/**
 * Making Decisions orchestrator. Per-BP tabs, reference panel reuse,
 * Continue gate.
 *
 * Continue gate: each BP must have ≥1 word with is_best_word_for_chunk
 * = true. TS-best is intentionally optional — students may delay that
 * decision until they're drafting at t-chart time, since it doesn't
 * gate any downstream step's data flow. Names the offending BP.
 *
 * Tabs, layout and footer come from StepShell.
 */

import { DecisionsBpPane } from "./decisions-bp-pane";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import type { CommentaryBpData } from "@/lib/queries/commentary";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { StepShell, type StepGate } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly CommentaryBpData[];
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

function computeGate(bps: readonly CommentaryBpData[]): StepGate {
  for (const bp of bps) {
    let hasChunkBest = false;
    for (const chunk of bp.chunks) {
      for (const cd of chunk.cds) {
        if (cd.words.some((w) => w.is_best_word_for_chunk)) {
          hasChunkBest = true;
          break;
        }
      }
      if (hasChunkBest) break;
    }
    if (!hasChunkBest) {
      return {
        canContinue: false,
        message: `Body paragraph ${bp.position} needs at least one word marked 'best for chunk'.`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each body paragraph has at least one chunk-best word.",
  };
}

export function DecisionsClient({
  writingId,
  stepKey,
  bps,
  sources,
  annotations,
}: Props) {
  const { pending, error, run } = useServerAction();

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) => `Body ${bp.position}`}
      renderPane={(bp) => <DecisionsBpPane writingId={writingId} bp={bp} />}
      emptyMessage="No body paragraphs yet."
      gate={computeGate(bps)}
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
