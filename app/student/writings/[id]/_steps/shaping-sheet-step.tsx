/**
 * Server entry for the shaping_sheet step (4 modes).
 *
 * Calls bootstrapShapingSheets on every visit (idempotent). The
 * bootstrap creates one shaping_sheets row per BP and — for CD/CM
 * modes — one shaping_chunk_outputs row per (sheet, chunk).
 * Narrative skips chunk_outputs (no chunks).
 *
 * Then fetches the shaping data tree and hands it to the client.
 */

import { bootstrapShapingSheets } from "@/lib/actions/shaping";
import { getShapingData } from "@/lib/queries/shaping";
import { ShapingClient } from "@/components/student/writing/shaping/shaping-client";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
  mode: Mode;
  hasCounterargument: boolean;
}

export async function ShapingSheetStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
  mode,
  hasCounterargument,
}: Props) {
  await bootstrapShapingSheets(writingId);
  const bps = await getShapingData(writingId);

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {stepLabel}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{stepLabel}</h2>
        {pedagogyHint && (
          <p className="mt-1 text-sm text-gray-600">{pedagogyHint}</p>
        )}
      </header>

      <ShapingClient
        writingId={writingId}
        stepKey={stepKey}
        mode={mode}
        hasCounterargument={hasCounterargument}
        bps={bps}
      />
    </div>
  );
}
