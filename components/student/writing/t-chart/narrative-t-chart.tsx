"use client";

/**
 * Narrative T-chart form. Shows ONLY the WOW Brainstorm section now;
 * the Discovery section moved to its own step in chunk 4.5c
 * (components/student/writing/discovery/). The 5 narrative_* fields
 * (kind, subject, key_word, general_ideas, concrete_example) still
 * live on t_charts — only the UI surface relocated.
 *
 * Adds a read-only "From your discovery" header above WOW so the
 * student stays anchored to what they discovered while filling in
 * the senses-and-action details. Empty discovery → informational
 * fallback copy (no back button — step sidebar handles navigation).
 */

import { AutoSaveInput } from "./auto-save-input";
import { updateTChart } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";

export function NarrativeTChart({
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
    <div className="space-y-6">
      <DiscoveryContextHeader
        keyWord={tc.narrative_key_word ?? ""}
        concreteExample={tc.narrative_concrete_example ?? ""}
      />

      <Section title="WOW Brainstorm">
        <p className="text-xs text-gray-500 -mt-1">
          Web Off the Word — capture the senses, the action, and what
          you were feeling and thinking.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="When" help="Time of day, season, age, era.">
            <AutoSaveInput
              initialValue={tc.narrative_when ?? ""}
              disabled={isReadOnly}
              onSave={async (narrative_when) => {
                await updateTChart(writingId, tc.id, { narrative_when });
              }}
            />
          </Field>
          <Field label="Where" help="Place, sensory details.">
            <AutoSaveInput
              initialValue={tc.narrative_where ?? ""}
              disabled={isReadOnly}
              onSave={async (narrative_where) => {
                await updateTChart(writingId, tc.id, { narrative_where });
              }}
            />
          </Field>
          <Field label="Who" help="People in the moment.">
            <AutoSaveInput
              initialValue={tc.narrative_who ?? ""}
              disabled={isReadOnly}
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
              disabled={isReadOnly}
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
            disabled={isReadOnly}
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
              disabled={isReadOnly}
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
              disabled={isReadOnly}
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

function DiscoveryContextHeader({
  keyWord,
  concreteExample,
}: {
  keyWord: string;
  concreteExample: string;
}) {
  const kw = keyWord.trim();
  const ex = concreteExample.trim();
  const hasContext = kw.length > 0 || ex.length > 0;

  if (!hasContext) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
        Add a key word and concrete example on the Discovering step to
        anchor this BP.
      </div>
    );
  }

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-amber-900 mb-0.5">
        From your discovery
      </div>
      <div className="text-sm text-gray-900">
        {kw && <span className="font-semibold">{kw}</span>}
        {kw && ex && <span className="text-gray-500"> — </span>}
        {ex && <span className="line-clamp-2">{ex}</span>}
      </div>
    </div>
  );
}

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
