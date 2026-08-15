"use client";

/**
 * Elaboration orchestrator. Per-BP tabs, reference panel reuse,
 * Continue gate.
 *
 * Continue gate: each BP must have every best word (a CD.words item
 * with is_best_word_for_chunk) linked to ≥2 non-empty phrases
 * (via parent_cm_id). Ensures students generate multiple
 * elaboration "clouds" for each key word before advancing.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ElaborationBpPane } from "./elaboration-bp-pane";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { useWritingMode } from "../use-writing-mode";
import { computeGate } from "./compute-gate";
import type { CommentaryBpData } from "@/lib/queries/commentary";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { SubmitStepButton } from "../submit-step-button";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly CommentaryBpData[];
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}


export function ElaborationClient({
  writingId,
  stepKey,
  bps,
  sources,
  annotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [activeIdx, setActiveIdx] = useState(0);
  const { pending, error, run } = useServerAction();

  const gate = computeGate(bps);
  const activeBp = bps[activeIdx] ?? bps[0];
  const showReference = sources.length > 0;

  const onContinue = () => {
    run(() => completeStepAndAdvance(writingId, stepKey));
  };

  const formColumn = (
    <div className="space-y-4 min-w-0">
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
        <ElaborationBpPane writingId={writingId} bp={activeBp} />
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet.
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
            {gate.canContinue
              ? "Each best word has at least two elaboration phrases."
              : `Body paragraph ${gate.blockerPosition} needs two phrases for each best word.`}
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
