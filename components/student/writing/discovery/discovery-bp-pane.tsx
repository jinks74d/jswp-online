"use client";

/**
 * One body paragraph's discovery pane. Five fields lifted from
 * chunk 4.4's narrative-t-chart Discovery section:
 *   - kind / subject (selects)
 *   - key word (input)
 *   - general ideas (comma-separated; preserves chunk 4.4 students'
 *     in-flight data without UX migration)
 *   - concrete example (textarea)
 *
 * All five live on t_charts and are written via updateTChart.
 */

import { useState } from "react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { updateTChart } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export function DiscoveryBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: BodyParagraphData;
}) {
  const { isReadOnly } = useWritingMode();
  if (!bp.t_chart) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        T-chart not yet bootstrapped for this body paragraph. Reload the
        page to retry.
      </div>
    );
  }
  const tc = bp.t_chart;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <KindSelect
          initialValue={tc.narrative_kind}
          disabled={isReadOnly}
          onSave={async (v) => {
            await updateTChart(writingId, tc.id, { narrative_kind: v });
          }}
        />
        <SubjectSelect
          initialValue={tc.narrative_subject}
          disabled={isReadOnly}
          onSave={async (v) => {
            await updateTChart(writingId, tc.id, { narrative_subject: v });
          }}
        />
      </div>

      <Field label="Key word" help="One word that captures the moment.">
        <AutoSaveInput
          initialValue={tc.narrative_key_word ?? ""}
          placeholder="e.g. courage, betrayal, joy"
          disabled={isReadOnly}
          onSave={async (narrative_key_word) => {
            await updateTChart(writingId, tc.id, { narrative_key_word });
          }}
        />
      </Field>

      <Field
        label="General ideas"
        help="Brainstorm associated ideas. Separate with commas."
      >
        <GeneralIdeasInput
          initialValue={tc.narrative_general_ideas ?? []}
          disabled={isReadOnly}
          onSave={async (narrative_general_ideas) => {
            await updateTChart(writingId, tc.id, { narrative_general_ideas });
          }}
        />
      </Field>

      <Field
        label="Concrete example"
        help="A specific moment that brings the key word to life."
      >
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={tc.narrative_concrete_example ?? ""}
          placeholder="The moment when…"
          disabled={isReadOnly}
          onSave={async (narrative_concrete_example) => {
            await updateTChart(writingId, tc.id, {
              narrative_concrete_example,
            });
          }}
        />
      </Field>
    </section>
  );
}

/* ─── Helpers (lifted verbatim from chunk 4.4 narrative-t-chart) ───── */

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-900">{label}</div>
      {help && <div className="text-xs text-gray-500 mt-0.5">{help}</div>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function KindSelect({
  initialValue,
  disabled,
  onSave,
}: {
  initialValue: NarrativeKind | null;
  disabled?: boolean;
  onSave: (v: NarrativeKind | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  return (
    <Field label="Kind" help="Personal narrative or fictional?">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          const v = (value || null) as NarrativeKind | null;
          await onSave(v);
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50"
      >
        <option value="">— Select —</option>
        <option value="personal">Personal</option>
        <option value="fictional">Fictional</option>
      </select>
    </Field>
  );
}

function SubjectSelect({
  initialValue,
  disabled,
  onSave,
}: {
  initialValue: NarrativeSubject | null;
  disabled?: boolean;
  onSave: (v: NarrativeSubject | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  return (
    <Field label="Subject" help="What is the narrative centered on?">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          const v = (value || null) as NarrativeSubject | null;
          await onSave(v);
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50"
      >
        <option value="">— Select —</option>
        <option value="event">Event</option>
        <option value="person">Person</option>
        <option value="place">Place</option>
        <option value="thing">Thing</option>
      </select>
    </Field>
  );
}

function GeneralIdeasInput({
  initialValue,
  disabled,
  onSave,
}: {
  initialValue: readonly string[];
  disabled?: boolean;
  onSave: (v: string[] | null) => Promise<void>;
}) {
  return (
    <AutoSaveInput
      initialValue={initialValue.join(", ")}
      placeholder="freedom, fear, growing up"
      disabled={disabled}
      onSave={async (raw) => {
        const arr = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        await onSave(arr.length > 0 ? arr : null);
      }}
    />
  );
}
