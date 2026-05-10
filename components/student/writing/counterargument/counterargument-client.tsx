"use client";

/**
 * Counterargument step orchestrator (Argumentation, conditional on
 * has_counterargument). Per-BP tabs with three textareas each.
 *
 * Continue gate: each BP must have ≥1 of {concession, counterargument,
 * refutation} non-empty (trimmed). Soft per-BP gate, named-BP tooltip.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  CounterargumentBpPane,
  type CounterargumentBpData,
} from "./counterargument-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "../use-writing-mode";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly CounterargumentBpData[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

function computeGate(
  bps: readonly CounterargumentBpData[]
): GateResult {
  for (const bp of bps) {
    const tc = bp.t_chart;
    const hasAny =
      !!(tc?.concession?.trim()) ||
      !!(tc?.counterargument?.trim()) ||
      !!(tc?.refutation?.trim());
    if (!hasAny) {
      return { canContinue: false, blockerPosition: bp.position };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function CounterargumentClient({
  writingId,
  stepKey,
  bps,
}: Props) {
  const { isReadOnly } = useWritingMode();
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
        <CounterargumentBpPane writingId={writingId} bp={activeBp} />
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet.
        </div>
      )}

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gate.canContinue
              ? "Each body paragraph has at least one C/CA/R field filled."
              : `Body paragraph ${gate.blockerPosition} needs a concession, counterargument, or refutation.`}
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
