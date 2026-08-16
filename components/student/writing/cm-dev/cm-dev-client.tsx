"use client";

/**
 * Generating Commentary (cm_dev) orchestrator. Per-BP tabs, reference
 * panel reuse, Continue gate.
 *
 * Continue gate: every CD across all BPs has ≥1 word-CM with non-empty
 * text. Pedagogy hint says 5; we don't enforce 5 — only ≥1. Names the
 * offending BP when blocked.
 *
 * Tabs, layout and footer come from StepShell.
 */

import { CmDevBpPane } from "./cm-dev-bp-pane";
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
    let cdCount = 0;
    let cdsWithWord = 0;
    for (const chunk of bp.chunks) {
      for (const cd of chunk.cds) {
        cdCount++;
        if (cd.words.some((w) => w.text.trim().length > 0)) {
          cdsWithWord++;
        }
      }
    }
    if (cdCount > 0 && cdsWithWord < cdCount) {
      return {
        canContinue: false,
        message: `Body paragraph ${bp.position} needs at least one word per concrete detail.`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each CD has at least one brainstormed word.",
  };
}

export function CmDevClient({
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
      renderPane={(bp) => <CmDevBpPane writingId={writingId} bp={bp} />}
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
