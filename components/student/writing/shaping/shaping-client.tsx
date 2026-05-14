"use client";

/**
 * Shaping orchestrator. Per-BP tabs; routes each BP to either
 * cd-cm-shaping-bp-pane or narrative-shaping-bp-pane based on mode.
 *
 * Continue gate (mode-aware):
 *   - All modes: each BP must have non-empty final_topic_sentence
 *     OR final_concluding_sentence (ideally both, gate on either to
 *     stay soft).
 *   - CD/CM modes: each chunk must have ≥1 cd_sentence AND ≥1
 *     cm_sentence. Empty arrays or all-empty-strings count as missing.
 *   - Narrative: TS/CS gate only; no chunk checks.
 *
 * Tooltip names the offending BP.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { CdCmShapingBpPane } from "./cd-cm-shaping-bp-pane";
import { NarrativeShapingBpPane } from "./narrative-shaping-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import { useWritingMode } from "../use-writing-mode";
import type { ShapingBpData } from "@/lib/queries/shaping";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  mode: Mode;
  hasCounterargument: boolean;
  bps: readonly ShapingBpData[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
  reason: string | null;
}

function computeGate(
  mode: Mode,
  bps: readonly ShapingBpData[]
): GateResult {
  const isNarrative = mode === "narrative";
  for (const bp of bps) {
    const ss = bp.shaping_sheet;
    const hasTs = !!(ss?.final_topic_sentence?.trim());
    const hasCs = !!(ss?.final_concluding_sentence?.trim());
    if (!hasTs && !hasCs) {
      return {
        canContinue: false,
        blockerPosition: bp.position,
        reason: "needs a final TS or CS",
      };
    }

    if (!isNarrative) {
      // Each chunk needs ≥1 non-empty CD sentence and ≥1 non-empty CM sentence.
      for (const chunk of bp.chunks) {
        const out = chunk.output;
        const cdCount =
          out?.cd_sentences.filter((s) => s.trim().length > 0).length ?? 0;
        const cmCount =
          out?.cm_sentences.filter((s) => s.trim().length > 0).length ?? 0;
        if (cdCount === 0 || cmCount === 0) {
          return {
            canContinue: false,
            blockerPosition: bp.position,
            reason: `chunk ${chunk.position} needs at least one CD sentence and one CM sentence`,
          };
        }
      }
    }
  }
  return { canContinue: true, blockerPosition: null, reason: null };
}

export function ShapingClient({
  writingId,
  stepKey,
  mode,
  hasCounterargument,
  bps,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(mode, bps);
  const activeBp = bps[activeIdx] ?? bps[0];
  const isNarrative = mode === "narrative";

  const onContinue = () => {
    setError(null);
    start(async () => {
      try {
        await completeStepAndAdvance(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        setError(msg || "Could not continue.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {bps.length > 1 && (
        <div
          role="tablist"
          aria-label="Body paragraphs"
          className="flex gap-1 border-b border-gray-200 overflow-x-auto"
        >
          {bps.map((bp, i) => {
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
                  bp.narrative_kind,
                  bp.narrative_subject,
                  bp.position,
                  bps.length
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeBp ? (
        isNarrative ? (
          <NarrativeShapingBpPane writingId={writingId} bp={activeBp} />
        ) : (
          <CdCmShapingBpPane
            writingId={writingId}
            bp={activeBp}
            mode={mode}
            hasCounterargument={hasCounterargument}
          />
        )
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet.
        </div>
      )}

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gate.canContinue
              ? "Each body paragraph is shaped."
              : `Body paragraph ${gate.blockerPosition} ${gate.reason}.`}
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={!gate.canContinue || pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
