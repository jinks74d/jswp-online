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

import { SheetEditor } from "./sheet-editor";
import { ReferencePanel, type ReferenceSource } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import { StepFooter, type StepGate } from "../step-shell";

interface Props {
  writingId: string;
  stepKey: string;
  sheets: readonly GatheringSheetData[];
  // Reference panel data (only present when assignment has source text)
  sources: readonly ReferenceSource[];
  annotations: readonly TextAnnotationRow[];
}

function computeGate(sheets: readonly GatheringSheetData[]): StepGate {
  for (const sheet of sheets) {
    const hasSelected = sheet.candidates.some((c) => c.is_selected);
    if (!hasSelected) {
      return {
        canContinue: false,
        message: `Body paragraph ${sheet.body_paragraph_position} needs at least one selected concrete detail.`,
      };
    }
  }
  return {
    canContinue: true,
    message: "Each body paragraph has at least one selected candidate.",
  };
}

export function GatherCdsClient({
  writingId,
  stepKey,
  sheets,
  sources,
  annotations,
}: Props) {
  // Read-only is StepFooter's concern — the sheets stay visible so a teacher
  // can review the student's selections.
  const { pending, error, run } = useServerAction();

  const gate = computeGate(sheets);
  const showReference = sources.length > 0;

  const onContinue = () => {
    run(() => completeStepAndAdvance(writingId, stepKey));
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
              style={{ borderLeft: "4px solid var(--brand)" }}
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

      <StepFooter
        writingId={writingId}
        stepKey={stepKey}
        gate={gate}
        onContinue={onContinue}
        pending={pending}
        error={error}
      />
    </div>
  );
}
