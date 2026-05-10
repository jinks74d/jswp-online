"use client";

/**
 * Topic-Sentence-Development orchestrator. Per-BP tabs + reference
 * panel + Continue gate. Mirrors gather-cds-client structure so
 * students learn one mental model across the brainstorm cluster.
 *
 * Continue gate: each BP's sheet must have ≥1 selected candidate AND
 * that candidate must have a side tag. Rationale: the printed guide
 * uses the pro/con tally to choose direction; without a tag, there's
 * no signal to derive direction from. Tooltip names the offending BP.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { TsdBpPane } from "./tsd-bp-pane";
import { ReferencePanel } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "../use-writing-mode";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

interface Props {
  writingId: string;
  stepKey: string;
  sheets: readonly GatheringSheetData[];
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  annotations: readonly TextAnnotationRow[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

function computeGate(sheets: readonly GatheringSheetData[]): GateResult {
  for (const sheet of sheets) {
    const tagged = sheet.candidates.filter(
      (c) => c.is_selected && c.argumentation_side !== null
    );
    if (tagged.length === 0) {
      return {
        canContinue: false,
        blockerPosition: sheet.body_paragraph_position,
      };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function TsdClient({
  writingId,
  stepKey,
  sheets,
  sourceText,
  sourceTitle,
  sourceAuthor,
  annotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(sheets);
  const activeSheet = sheets[activeIdx] ?? sheets[0];
  const showReference = sourceText !== null;

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

  const formColumn = (
    <div className="space-y-4 min-w-0">
      {sheets.length > 1 && (
        <div
          role="tablist"
          aria-label="Body paragraphs"
          className="flex gap-1 border-b border-gray-200 overflow-x-auto"
        >
          {sheets.map((sheet, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={sheet.id}
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
                Body {sheet.body_paragraph_position}
              </button>
            );
          })}
        </div>
      )}

      {activeSheet ? (
        <TsdBpPane writingId={writingId} sheet={activeSheet} />
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No gathering sheets yet. Go back to gather-cds first.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {showReference && sourceText && (
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
              sourceText={sourceText}
              sourceTitle={sourceTitle}
              sourceAuthor={sourceAuthor}
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

        {showReference && sourceText && (
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <ReferencePanel
              sourceText={sourceText}
              sourceTitle={sourceTitle}
              sourceAuthor={sourceAuthor}
              annotations={annotations}
            />
          </aside>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gate.canContinue
              ? "Each body paragraph has at least one tagged candidate."
              : `Body paragraph ${gate.blockerPosition} needs at least one tagged candidate (For / Against / Neutral).`}
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
