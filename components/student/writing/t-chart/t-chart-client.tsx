"use client";

/**
 * T-chart step orchestrator. Lays out:
 *
 *   Desktop: [tabs (BP1, BP2, ...)]   [reference panel]
 *            [active BP form]           [...]
 *
 *   Mobile:  reference panel collapses to <details> at the top, tabs
 *            scroll horizontally, form below.
 *
 * Picks CdCmTChart vs NarrativeTChart based on writing.mode and
 * computes the per-BP Continue gate from the current data prop. Data
 * stays in props (not local state) so revalidatePath after each
 * mutation flows fresh state down without manual sync.
 *
 * The gate rules themselves live in ./compute-gate so they can be unit
 * tested without this component's `server-only` import chain.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CdCmTChart } from "./cd-cm-t-chart";
import { ExpositoryTChart } from "./expository-t-chart";
import { NarrativeTChart } from "./narrative-t-chart";
import { FictionalAbcPlan } from "./fictional-abc-plan";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import { computeGate, gateMessage } from "./compute-gate";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import type { Database } from "@/lib/database.types";
import { SubmitStepButton } from "../submit-step-button";

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
  const { isReadOnly } = useWritingMode();
  const [activeIdx, setActiveIdx] = useState(0);
  const { pending, error, run } = useServerAction();

  const gate = computeGate(mode, bodyParagraphs);
  const activeBp = bodyParagraphs[activeIdx] ?? bodyParagraphs[0];
  const isNarrative = mode === "narrative";
  // Expository drops the source-text reference panel on the T-Chart —
  // the student already read & annotated in the prior step, so the
  // T-Chart gets the full width. Argumentation/literary keep it (they
  // cite the source while building the chart). Decision: Raymond,
  // 2026-06-08.
  const showReference = sources.length > 0 && mode !== "expository";

  const onContinue = () => {
    run(() => completeStepAndAdvance(writingId, stepKey));
  };

  const formColumn = (
    <div className="space-y-4 min-w-0">
      {bodyParagraphs.length > 1 && (
        <div
          role="tablist"
          aria-label="Body paragraphs"
          className="flex gap-1 border-b border-gray-200 overflow-x-auto"
        >
          {bodyParagraphs.map((bp, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={bp.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveIdx(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  active
                    ? "text-gray-900"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
                style={
                  active
                    ? { borderBottomColor: "var(--district-primary)" }
                    : undefined
                }
              >
                {narrativeBpLabel(
                  bp.t_chart?.narrative_kind ?? null,
                  bp.t_chart?.narrative_subject ?? null,
                  bp.position,
                  bodyParagraphs.length
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeBp ? (
        isNarrative ? (
          activeBp.t_chart?.narrative_kind === "fictional" ? (
            <FictionalAbcPlan writingId={writingId} bp={activeBp} />
          ) : (
            <NarrativeTChart writingId={writingId} bp={activeBp} />
          )
        ) : mode === "expository" ? (
          <ExpositoryTChart
            writingId={writingId}
            bp={activeBp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
            annotations={annotations}
          />
        ) : (
          <CdCmTChart
            writingId={writingId}
            bp={activeBp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
          />
        )
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet. Reload to bootstrap.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {showReference && (
        <details className="lg:hidden bg-white border border-gray-200 rounded-lg group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Source text & annotations
            </span>
            <span className="text-xs text-gray-500 group-open:hidden">Show</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <ReferencePanel
              writingId={writingId}
              sources={sources}
              annotations={annotations}
            />
          </div>
        </details>
      )}

      <div
        className={`grid gap-6 ${
          showReference
            ? "lg:grid-cols-[minmax(0,1fr)_22rem]"
            : "grid-cols-1"
        }`}
      >
        {formColumn}

        {showReference && (
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <ReferencePanel
              writingId={writingId}
              sources={sources}
              annotations={annotations}
            />
          </aside>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gateMessage(gate, bodyParagraphs.length)}
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <SubmitStepButton writingId={writingId} stepKey={stepKey} />
            <button
              type="button"
              onClick={onContinue}
              disabled={!gate.canContinue || pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
