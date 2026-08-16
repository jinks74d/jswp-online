"use client";

/**
 * Shaping orchestrator. Per-BP tabs; routes each BP to either
 * cd-cm-shaping-bp-pane or narrative-shaping-bp-pane based on mode.
 *
 * Continue gate (mode-aware, in lib/shaping-gate.ts):
 *   - All modes: each BP must have non-empty final_topic_sentence
 *     OR final_concluding_sentence (ideally both, gate on either to
 *     stay soft).
 *   - CD/CM modes: each chunk must have ≥1 cd_sentence AND ≥1
 *     cm_sentence. Empty arrays or all-empty-strings count as missing.
 *   - Narrative: TS/CS gate only; no chunk checks.
 *
 * The gate names the offending BP and, for a chunk failure, which chunk —
 * that specificity is carried in its own `reason` and must survive into the
 * sentence below. Tabs, layout and footer come from StepShell.
 */

import { CdCmShapingBpPane } from "./cd-cm-shaping-bp-pane";
import { NarrativeShapingBpPane } from "./narrative-shaping-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import { computeGate } from "@/lib/shaping-gate";
import type { ShapingBpData } from "@/lib/queries/shaping";
import type { Database } from "@/lib/database.types";
import { StepShell } from "../step-shell";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  mode: Mode;
  hasCounterargument: boolean;
  bps: readonly ShapingBpData[];
}

export function ShapingClient({
  writingId,
  stepKey,
  mode,
  hasCounterargument,
  bps,
}: Props) {
  const { pending, error, run } = useServerAction();
  const gate = computeGate(mode, bps);
  const isNarrative = mode === "narrative";

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) =>
        narrativeBpLabel(
          bp.narrative_kind,
          bp.narrative_subject,
          bp.position,
          bps.length
        )
      }
      renderPane={(bp) =>
        isNarrative ? (
          <NarrativeShapingBpPane writingId={writingId} bp={bp} />
        ) : (
          <CdCmShapingBpPane
            writingId={writingId}
            bp={bp}
            mode={mode}
            hasCounterargument={hasCounterargument}
          />
        )
      }
      emptyMessage="No body paragraphs yet."
      gate={{
        canContinue: gate.canContinue,
        message: gate.canContinue
          ? "Each body paragraph is shaped."
          : `Body paragraph ${gate.blockerPosition} ${gate.reason}.`,
      }}
      onContinue={() => run(() => completeStepAndAdvance(writingId, stepKey))}
      pending={pending}
      error={error}
    />
  );
}
