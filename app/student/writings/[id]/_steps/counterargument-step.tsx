/**
 * Server entry for the Argumentation counterargument step.
 *
 * Writes draft text to t_charts.{concession, counterargument,
 * refutation} per BP. Conditional in the step engine on
 * assignment.has_counterargument; the dispatcher already only routes
 * here when the step is in the visible step list.
 *
 * Bootstrap: relies on writing-structure to have created the BPs
 * and t_charts rows (chunk 4.4's bootstrap, called by the upstream
 * t-chart step that the student passed through to reach here). We
 * call bootstrapWritingStructure defensively — idempotent, cheap.
 *
 * Focused query (inlined): just BPs + their t_chart's three
 * counterargument fields. No need for the full shaping data tree.
 */

import { bootstrapWritingStructure } from "@/lib/actions/writing-structure";
import { createServerClient } from "@/lib/supabase/server";
import { CounterargumentClient } from "@/components/student/writing/counterargument/counterargument-client";
import type { CounterargumentBpData } from "@/components/student/writing/counterargument/counterargument-bp-pane";

interface Props {
  writingId: string;
  stepKey: string;
  stepLabel: string;
  pedagogyHint: string | null;
}

interface RawBp {
  id: string;
  position: number;
  t_chart:
    | {
        id: string;
        concession: string | null;
        counterargument: string | null;
        refutation: string | null;
      }
    | Array<{
        id: string;
        concession: string | null;
        counterargument: string | null;
        refutation: string | null;
      }>
    | null;
}

async function getCounterargumentData(
  writingId: string
): Promise<CounterargumentBpData[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("body_paragraphs")
    .select(
      `
      id, position,
      t_chart:t_charts ( id, concession, counterargument, refutation )
      `
    )
    .eq("student_writing_id", writingId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getCounterargumentData:", error);
    return [];
  }

  return ((data ?? []) as unknown as RawBp[]).map((bp) => ({
    id: bp.id,
    position: bp.position,
    t_chart: Array.isArray(bp.t_chart) ? (bp.t_chart[0] ?? null) : bp.t_chart,
  }));
}

export async function CounterargumentStep({
  writingId,
  stepKey,
  stepLabel,
  pedagogyHint,
}: Props) {
  await bootstrapWritingStructure(writingId);
  const bps = await getCounterargumentData(writingId);

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

      <CounterargumentClient
        writingId={writingId}
        stepKey={stepKey}
        bps={bps}
      />
    </div>
  );
}
