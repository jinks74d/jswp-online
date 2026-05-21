"use client";

/**
 * Gather-CDs orchestrator. Renders every body paragraph's gathering
 * sheet as its own stacked card (one card per BP, scrollable). Source
 * text + annotations live in a sticky right-rail when present. Continue
 * gate requires ≥1 is_selected=true on every BP's sheet; the tooltip
 * names the offending BP.
 *
 * No optimistic UI for the gate — server actions revalidate, fresh
 * data flows down through the bodyParagraphSheets prop.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SheetEditor } from "./sheet-editor";
import { ReferencePanel } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "../use-writing-mode";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

interface Props {
  writingId: string;
  stepKey: string;
  sheets: readonly GatheringSheetData[];
  // Reference panel data (only present when assignment has source text)
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
    const hasSelected = sheet.candidates.some((c) => c.is_selected);
    if (!hasSelected) {
      return {
        canContinue: false,
        blockerPosition: sheet.body_paragraph_position,
      };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function GatherCdsClient({
  writingId,
  stepKey,
  sheets,
  sourceText,
  sourceTitle,
  sourceAuthor,
  annotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(sheets);
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
    <div className="space-y-5 min-w-0">
      {sheets.length === 0 ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No gathering sheets yet. Reload to bootstrap.
        </div>
      ) : (
        sheets.map((sheet) => (
          <section
            key={sheet.id}
            aria-label={`Body Paragraph ${sheet.body_paragraph_position}`}
            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          >
            <header
              className="px-4 py-2.5 border-b border-gray-200 bg-gray-50"
              style={{ borderLeft: "4px solid var(--district-primary)" }}
            >
              <h3 className="text-sm font-semibold text-gray-900">
                Body Paragraph {sheet.body_paragraph_position}
              </h3>
            </header>
            <div className="p-4">
              <SheetEditor writingId={writingId} sheet={sheet} />
            </div>
          </section>
        ))
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
              ? "Each body paragraph has at least one selected candidate."
              : `Body paragraph ${gate.blockerPosition} needs at least one selected concrete detail.`}
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
