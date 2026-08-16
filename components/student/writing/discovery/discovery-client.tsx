"use client";

/**
 * Discovering the Topic orchestrator (Narrative only). Per-BP tabs
 * with the 5-field discovery form. No reference panel — Narrative
 * usually has no source text.
 *
 * Continue gate: each BP must have ≥1 of {narrative_key_word,
 * narrative_concrete_example} non-empty. These are the spine of
 * the moment; kind/subject/general_ideas are auxiliary and don't
 * gate. Names the offending BP.
 *
 * Tabs, layout and footer come from StepShell.
 */

import { DiscoveryBpPane } from "./discovery-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import { StepShell, type StepGate } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly BodyParagraphData[];
}

function computeGate(bps: readonly BodyParagraphData[]): StepGate {
  for (const bp of bps) {
    const tc = bp.t_chart;
    const hasKeyWord = !!(tc?.narrative_key_word && tc.narrative_key_word.trim());
    const hasExample = !!(
      tc?.narrative_concrete_example && tc.narrative_concrete_example.trim()
    );
    if (!hasKeyWord && !hasExample) {
      return {
        canContinue: false,
        message: `Body paragraph ${bp.position} needs a key word or concrete example.`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each body paragraph has a key word or concrete example.",
  };
}

export function DiscoveryClient({ writingId, stepKey, bps }: Props) {
  const { pending, error, run } = useServerAction();

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) =>
        narrativeBpLabel(
          bp.t_chart?.narrative_kind ?? null,
          bp.t_chart?.narrative_subject ?? null,
          bp.position,
          bps.length
        )
      }
      renderPane={(bp) => <DiscoveryBpPane writingId={writingId} bp={bp} />}
      gate={computeGate(bps)}
      onContinue={() => run(() => completeStepAndAdvance(writingId, stepKey))}
      pending={pending}
      error={error}
    />
  );
}
