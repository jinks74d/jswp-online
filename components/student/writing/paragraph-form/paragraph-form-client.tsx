"use client";

/**
 * Paragraph-form orchestrator. Per-BP tabs; routes each BP to either
 * cd-cm-paragraph-form-bp-pane or narrative-paragraph-form-bp-pane
 * based on mode.
 *
 * Continue gate: each BP must have non-empty (trimmed) final_text.
 * Tooltip names the offending BP.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { CdCmParagraphFormBpPane } from "./cd-cm-paragraph-form-bp-pane";
import { NarrativeParagraphFormBpPane } from "./narrative-paragraph-form-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import type { ParagraphFormBpData } from "@/lib/queries/paragraph-form";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  mode: Mode;
  hasCounterargument: boolean;
  bps: readonly ParagraphFormBpData[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

function computeGate(bps: readonly ParagraphFormBpData[]): GateResult {
  for (const bp of bps) {
    const text = bp.paragraph_form?.final_text ?? "";
    if (text.trim().length === 0) {
      return { canContinue: false, blockerPosition: bp.position };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function ParagraphFormClient({
  writingId,
  stepKey,
  mode,
  hasCounterargument,
  bps,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(bps);
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
                Body {bp.position}
              </button>
            );
          })}
        </div>
      )}

      {activeBp ? (
        isNarrative ? (
          <NarrativeParagraphFormBpPane writingId={writingId} bp={activeBp} />
        ) : (
          <CdCmParagraphFormBpPane
            writingId={writingId}
            bp={activeBp}
            hasCounterargument={hasCounterargument}
          />
        )
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {gate.canContinue
            ? "Each body paragraph has a polished paragraph."
            : `Body paragraph ${gate.blockerPosition} needs at least one character of polished paragraph text.`}
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
