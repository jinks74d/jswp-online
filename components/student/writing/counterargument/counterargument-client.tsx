"use client";

/**
 * Counterargument step orchestrator (Argumentation, conditional on
 * has_counterargument). Per-BP tabs with three textareas each.
 *
 * Continue gate: each BP must have ≥1 of {concession, counterargument,
 * refutation} non-empty (trimmed). Soft per-BP gate, naming the offending BP.
 *
 * Tabs, layout and footer come from StepShell. What stays here is the part
 * that is actually about counterargument: the gate rule and its wording.
 */

import {
  CounterargumentBpPane,
  type CounterargumentBpData,
} from "./counterargument-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { StepShell, type StepGate } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly CounterargumentBpData[];
}

function computeGate(bps: readonly CounterargumentBpData[]): StepGate {
  for (const bp of bps) {
    const tc = bp.t_chart;
    const hasAny =
      !!(tc?.concession?.trim()) ||
      !!(tc?.counterargument?.trim()) ||
      !!(tc?.refutation?.trim());
    if (!hasAny) {
      return {
        canContinue: false,
        message: `Body paragraph ${bp.position} needs a concession, counterargument, or refutation.`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each body paragraph has at least one C/CA/R field filled.",
  };
}

export function CounterargumentClient({ writingId, stepKey, bps }: Props) {
  const { pending, error, run } = useServerAction();

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) => `Body ${bp.position}`}
      renderPane={(bp) => (
        <CounterargumentBpPane writingId={writingId} bp={bp} />
      )}
      emptyMessage="No body paragraphs yet."
      gate={computeGate(bps)}
      onContinue={() => run(() => completeStepAndAdvance(writingId, stepKey))}
      pending={pending}
      error={error}
    />
  );
}
