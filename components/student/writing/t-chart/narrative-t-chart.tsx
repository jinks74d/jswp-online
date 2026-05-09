"use client";

/**
 * Narrative T-chart form. The schema's t_charts row has 11
 * narrative_* columns; this UI exposes them all directly. No
 * chunks, no CD/CM rows.
 *
 * Layout follows the printed Narrative guide's WOW (Web Off the
 * Word) brainstorm:
 *
 *   Discovery: kind / subject / key word / general ideas /
 *              concrete example
 *   WOW:       when / where / who / what happened / dialogue /
 *              feeling / thinking
 */

import { useState } from "react";
import { AutoSaveInput } from "./auto-save-input";
import { updateTChart } from "@/lib/actions/t-charts";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

export function NarrativeTChart({
  writingId,
  bp,
}: {
  writingId: string;
  bp: BodyParagraphData;
}) {
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
    <div className="space-y-6">
      <Section title="Discovery">
        <div className="grid gap-4 md:grid-cols-2">
          <KindSelect
            initialValue={tc.narrative_kind}
            onSave={async (v) => {
              await updateTChart(writingId, tc.id, { narrative_kind: v });
            }}
          />
          <SubjectSelect
            initialValue={tc.narrative_subject}
            onSave={async (v) => {
              await updateTChart(writingId, tc.id, { narrative_subject: v });
            }}
          />
        </div>

        <Field label="Key word" help="One word that captures the moment.">
          <AutoSaveInput
            initialValue={tc.narrative_key_word ?? ""}
            placeholder="e.g. courage, betrayal, joy"
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
            onSave={async (narrative_concrete_example) => {
              await updateTChart(writingId, tc.id, {
                narrative_concrete_example,
              });
            }}
          />
        </Field>
      </Section>

      <Section title="WOW Brainstorm">
        <p className="text-xs text-gray-500 -mt-1">
          Web Off the Word — capture the senses, the action, and what
          you were feeling and thinking.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="When" help="Time of day, season, age, era.">
            <AutoSaveInput
              initialValue={tc.narrative_when ?? ""}
              onSave={async (narrative_when) => {
                await updateTChart(writingId, tc.id, { narrative_when });
              }}
            />
          </Field>
          <Field label="Where" help="Place, sensory details.">
            <AutoSaveInput
              initialValue={tc.narrative_where ?? ""}
              onSave={async (narrative_where) => {
                await updateTChart(writingId, tc.id, { narrative_where });
              }}
            />
          </Field>
          <Field label="Who" help="People in the moment.">
            <AutoSaveInput
              initialValue={tc.narrative_who ?? ""}
              onSave={async (narrative_who) => {
                await updateTChart(writingId, tc.id, { narrative_who });
              }}
            />
          </Field>
          <Field label="What happened" help="The action — verbs first.">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={tc.narrative_what_happened ?? ""}
              onSave={async (narrative_what_happened) => {
                await updateTChart(writingId, tc.id, {
                  narrative_what_happened,
                });
              }}
            />
          </Field>
        </div>

        <Field
          label="Dialogue"
          help="Words spoken — yours, theirs, or both."
        >
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={tc.narrative_dialogue ?? ""}
            placeholder={`"Where do you think you're going?" she asked.`}
            onSave={async (narrative_dialogue) => {
              await updateTChart(writingId, tc.id, { narrative_dialogue });
            }}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Feeling" help="What did your body feel?">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={tc.narrative_feeling ?? ""}
              onSave={async (narrative_feeling) => {
                await updateTChart(writingId, tc.id, { narrative_feeling });
              }}
            />
          </Field>
          <Field label="Thinking" help="What ran through your mind?">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={tc.narrative_thinking ?? ""}
              onSave={async (narrative_thinking) => {
                await updateTChart(writingId, tc.id, { narrative_thinking });
              }}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
        {title}
      </h3>
      {children}
    </section>
  );
}

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
  onSave,
}: {
  initialValue: NarrativeKind | null;
  onSave: (v: NarrativeKind | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  return (
    <Field label="Kind" help="Personal narrative or fictional?">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          const v = (value || null) as NarrativeKind | null;
          await onSave(v);
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
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
  onSave,
}: {
  initialValue: NarrativeSubject | null;
  onSave: (v: NarrativeSubject | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  return (
    <Field label="Subject" help="What is the narrative centered on?">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          const v = (value || null) as NarrativeSubject | null;
          await onSave(v);
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
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
  onSave,
}: {
  initialValue: readonly string[];
  onSave: (v: string[] | null) => Promise<void>;
}) {
  return (
    <AutoSaveInput
      initialValue={initialValue.join(", ")}
      placeholder="freedom, fear, growing up"
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
