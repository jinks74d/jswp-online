"use client";

/**
 * Narrative shaping pane. Minimal compared to the CD/CM-mode shaping
 * because narrative writings have no chunks/CDs/CMs to weave from.
 *
 * Layout:
 *   - Read-only WOW context (key word, concrete example, when/where/
 *     who/what/dialogue/feeling/thinking) so the student stays anchored
 *     to the discovery + t-chart material while shaping
 *   - Working TS (read-only) + Final TS (autosave)
 *   - Working CS (read-only) + Final CS (autosave)
 *   - Notes
 *
 * No pick-n-stitch panel (no commentary_items in narrative).
 * No cd_sentences / cm_sentences (no chunks).
 */

import { AutoSaveInput } from "../t-chart/auto-save-input";
import { updateShapingSheet } from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type { ShapingBpData } from "@/lib/queries/shaping";

export function NarrativeShapingBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: ShapingBpData;
}) {
  const { isReadOnly } = useWritingMode();
  const ss = bp.shaping_sheet;
  if (!ss) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Shaping sheet not yet bootstrapped for this body paragraph. Reload
        the page to retry.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <WowContext bp={bp} />

      <Section title="Topic Sentence" accentClass="text-blue-700">
        {bp.working_topic_sentence && (
          <ReadOnlyContext label="Working TS (from topic-sentences step)">
            {bp.working_topic_sentence}
          </ReadOnlyContext>
        )}
        <Field
          label="Final TS"
          help="Vary sentence openings. Use transitions."
        >
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={ss.final_topic_sentence ?? ""}
            placeholder="Write the polished topic sentence…"
            disabled={isReadOnly}
            onSave={async (final_topic_sentence) => {
              await updateShapingSheet(writingId, ss.id, {
                final_topic_sentence,
              });
            }}
          />
        </Field>
      </Section>

      <Section title="Concluding Sentence" accentClass="text-blue-700">
        {bp.concluding_sentence && (
          <ReadOnlyContext label="CS (from t-chart)">
            {bp.concluding_sentence}
          </ReadOnlyContext>
        )}
        <Field label="Final CS">
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={ss.final_concluding_sentence ?? ""}
            placeholder="Write the polished concluding sentence…"
            disabled={isReadOnly}
            onSave={async (final_concluding_sentence) => {
              await updateShapingSheet(writingId, ss.id, {
                final_concluding_sentence,
              });
            }}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <AutoSaveInput
          multiline
          rows={3}
          initialValue={ss.notes ?? ""}
          placeholder="Anything to remember about this paragraph's shaping…"
          disabled={isReadOnly}
          onSave={async (notes) => {
            await updateShapingSheet(writingId, ss.id, { notes });
          }}
        />
      </Section>
    </div>
  );
}

/* ─── WOW read-only context ─────────────────────────────────────── */

function WowContext({ bp }: { bp: ShapingBpData }) {
  const items: Array<[string, string | null]> = [
    ["Key word", bp.narrative_key_word],
    ["Concrete example", bp.narrative_concrete_example],
    ["When", bp.narrative_when],
    ["Where", bp.narrative_where],
    ["Who", bp.narrative_who],
    ["What happened", bp.narrative_what_happened],
    ["Dialogue", bp.narrative_dialogue],
    ["Feeling", bp.narrative_feeling],
    ["Thinking", bp.narrative_thinking],
  ];

  const filled = items.filter(
    ([, v]) => v !== null && v !== undefined && v.trim().length > 0
  );

  if (filled.length === 0) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
        No discovery or WOW data yet — visit those steps first to anchor
        this paragraph.
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">
        From your discovery + WOW
      </div>
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)] text-sm">
        {filled.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs uppercase tracking-wide text-gray-500 sm:pt-0.5">
              {label}
            </dt>
            <dd className="text-gray-900 whitespace-pre-wrap line-clamp-3">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ─── Helpers (subset of cd-cm pane's helpers) ────────────────────── */

function Section({
  title,
  accentClass = "text-gray-700",
  children,
}: {
  title: string;
  accentClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3
        className={`text-sm font-semibold uppercase tracking-wide ${accentClass}`}
      >
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
    <div>
      <div className="text-sm font-medium text-gray-900">{label}</div>
      {help && <div className="text-xs text-gray-500 mt-0.5">{help}</div>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ReadOnlyContext({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-amber-900 mb-0.5">
        {label}
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{children}</p>
    </div>
  );
}
