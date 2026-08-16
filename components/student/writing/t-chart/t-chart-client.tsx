"use client";

/**
 * T-chart step orchestrator.
 *
 * Picks the right chart for the writing — fictional narrative gets the ABC
 * plan, other narrative the WOW chart, expository its own worksheet-style
 * grid, everything else the CD/CM chart — and computes the per-BP Continue
 * gate from the current data prop. Data stays in props (not local state) so
 * revalidatePath after each mutation flows fresh state down without manual
 * sync.
 *
 * The gate rules and their wording live in ./compute-gate so they can be unit
 * tested without this component's `server-only` import chain. Tabs, layout and
 * footer come from StepShell.
 */

import { CdCmTChart } from "./cd-cm-t-chart";
import { ExpositoryTChart } from "./expository-t-chart";
import { NarrativeTChart } from "./narrative-t-chart";
import { FictionalAbcPlan } from "./fictional-abc-plan";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import { computeGate, gateMessage } from "./compute-gate";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import type { Database } from "@/lib/database.types";
import { StepShell } from "../step-shell";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

interface Props {
  writingId: string;
  stepKey: string;
  mode: Mode;
  writingChunkRatio: ChunkRatio;
  bodyParagraphs: readonly BodyParagraphData[];
  // Reference panel data (only present when assignment has source text)
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

export function TChartClient({
  writingId,
  stepKey,
  mode,
  writingChunkRatio,
  bodyParagraphs,
  sources,
  annotations,
}: Props) {
  const { pending, error, run } = useServerAction();

  const gate = computeGate(mode, bodyParagraphs);
  const isNarrative = mode === "narrative";

  // Expository drops the source-text reference panel on the T-Chart —
  // the student already read & annotated in the prior step, so the
  // T-Chart gets the full width. Argumentation/literary keep it (they
  // cite the source while building the chart). Decision: Raymond,
  // 2026-06-08.
  const showReference = sources.length > 0 && mode !== "expository";

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bodyParagraphs}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) =>
        narrativeBpLabel(
          bp.t_chart?.narrative_kind ?? null,
          bp.t_chart?.narrative_subject ?? null,
          bp.position,
          bodyParagraphs.length
        )
      }
      renderPane={(bp) =>
        isNarrative ? (
          bp.t_chart?.narrative_kind === "fictional" ? (
            <FictionalAbcPlan writingId={writingId} bp={bp} />
          ) : (
            <NarrativeTChart writingId={writingId} bp={bp} />
          )
        ) : mode === "expository" ? (
          <ExpositoryTChart
            writingId={writingId}
            bp={bp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
            annotations={annotations}
          />
        ) : (
          <CdCmTChart
            writingId={writingId}
            bp={bp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
          />
        )
      }
      gate={{
        canContinue: gate.canContinue,
        message: gateMessage(gate, bodyParagraphs.length),
      }}
      onContinue={() => run(() => completeStepAndAdvance(writingId, stepKey))}
      pending={pending}
      error={error}
      reference={
        showReference ? (
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
