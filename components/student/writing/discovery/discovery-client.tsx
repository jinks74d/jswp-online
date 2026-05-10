"use client";

/**
 * Discovering the Topic orchestrator (Narrative only). Per-BP tabs
 * with the 5-field discovery form. No reference panel — Narrative
 * usually has no source text.
 *
 * Continue gate: each BP must have ≥1 of {narrative_key_word,
 * narrative_concrete_example} non-empty. These are the spine of
 * the moment; kind/subject/general_ideas are auxiliary and don't
 * gate. Tooltip names the offending BP.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { DiscoveryBpPane } from "./discovery-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import type { BodyParagraphData } from "@/lib/queries/t-charts";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly BodyParagraphData[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

function computeGate(bps: readonly BodyParagraphData[]): GateResult {
  for (const bp of bps) {
    const tc = bp.t_chart;
    const hasKeyWord = !!(tc?.narrative_key_word && tc.narrative_key_word.trim());
    const hasExample = !!(
      tc?.narrative_concrete_example && tc.narrative_concrete_example.trim()
    );
    if (!hasKeyWord && !hasExample) {
      return { canContinue: false, blockerPosition: bp.position };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function DiscoveryClient({ writingId, stepKey, bps }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(bps);
  const activeBp = bps[activeIdx] ?? bps[0];

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
                Body {bp.position}
              </button>
            );
          })}
        </div>
      )}

      {activeBp ? (
        <DiscoveryBpPane writingId={writingId} bp={activeBp} />
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet. Reload to bootstrap.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {gate.canContinue
            ? "Each body paragraph has a key word or concrete example."
            : `Body paragraph ${gate.blockerPosition} needs a key word or concrete example.`}
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
    </div>
  );
}
