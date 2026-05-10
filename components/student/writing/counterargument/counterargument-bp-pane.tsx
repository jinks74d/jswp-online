"use client";

/**
 * One body paragraph's counterargument pane (Argumentation only,
 * conditional on assignment.has_counterargument). Three textareas
 * writing draft text to t_charts.{concession, counterargument,
 * refutation}. Shaping later polishes those into shaping_sheets's
 * final_* fields.
 *
 * Uses updateTChart from lib/actions/t-charts.ts directly — no
 * dedicated counterargument action module since the writes target
 * existing t_charts columns and the action signature already covers
 * them (chunk 4.4's TChartFieldUpdates interface).
 */

import { AutoSaveInput } from "../t-chart/auto-save-input";
import { updateTChart } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";

export interface CounterargumentBpData {
  id: string;
  position: number;
  t_chart: {
    id: string;
    concession: string | null;
    counterargument: string | null;
    refutation: string | null;
  } | null;
}

export function CounterargumentBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: CounterargumentBpData;
}) {
  const { isReadOnly } = useWritingMode();
  const tc = bp.t_chart;
  if (!tc) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        T-chart row missing for this body paragraph. Reload the page to
        retry.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-600">
        Concede a point your opponent might raise. State it as a
        counterargument. Then refute it logically — show why your
        position is stronger.
      </p>

      <Field
        label="Concession"
        accentClass="text-purple-700"
        help="Acknowledge what's true on the other side."
      >
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={tc.concession ?? ""}
          placeholder="Some might argue that…"
          disabled={isReadOnly}
          onSave={async (concession) => {
            await updateTChart(writingId, tc.id, { concession });
          }}
        />
      </Field>

      <Field
        label="Counterargument"
        accentClass="text-orange-700"
        help="Lay out the opposing position fully and fairly."
      >
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={tc.counterargument ?? ""}
          placeholder="Critics claim that…"
          disabled={isReadOnly}
          onSave={async (counterargument) => {
            await updateTChart(writingId, tc.id, { counterargument });
          }}
        />
      </Field>

      <Field
        label="Refutation"
        accentClass="text-teal-700"
        help="Show why your position holds up despite the counterargument."
      >
        <AutoSaveInput
          multiline
          rows={3}
          initialValue={tc.refutation ?? ""}
          placeholder="However, this overlooks…"
          disabled={isReadOnly}
          onSave={async (refutation) => {
            await updateTChart(writingId, tc.id, { refutation });
          }}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  accentClass,
  help,
  children,
}: {
  label: string;
  accentClass: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wide ${accentClass}`}>
        {label}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{help}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
