"use client";

/**
 * Elaboration orchestrator. Per-BP tabs, reference panel reuse,
 * Continue gate.
 *
 * Continue gate: each BP must have every best word (a CD.words item
 * with is_best_word_for_chunk) linked to ≥2 non-empty phrases
 * (via parent_cm_id). Ensures students generate multiple
 * elaboration "clouds" for each key word before advancing.
 *
 * The rule and its wording live in ./compute-gate.ts, which is unit tested
 * without dragging this component tree into jsdom. Tabs, layout and footer
 * come from StepShell.
 */

import { ElaborationBpPane } from "./elaboration-bp-pane";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { computeGate, gateMessage } from "./compute-gate";
import type { CommentaryBpData } from "@/lib/queries/commentary";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { StepShell } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly CommentaryBpData[];
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

export function ElaborationClient({
  writingId,
  stepKey,
  bps,
  sources,
  annotations,
}: Props) {
  const { pending, error, run } = useServerAction();
  const gate = computeGate(bps);

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) => `Body ${bp.position}`}
      renderPane={(bp) => <ElaborationBpPane writingId={writingId} bp={bp} />}
      emptyMessage="No body paragraphs yet."
      gate={{ canContinue: gate.canContinue, message: gateMessage(gate) }}
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
