"use client";

/**
 * One body paragraph's shaping pane for expository / argumentation /
 * literary modes. Rebuilt in chunk 4.5d-3 to the guide's Shaping Sheet:
 * a single-column sequence of labeled boxes, each introduced by its
 * JSWP color/shape role-label (blue trapezoid TS, red rectangle CD,
 * green oval CM, blue trapezoid CS), with sentence text color-coded via
 * the --jswp-color-* tokens. See docs/reference/expository-organizer-specs.md.
 *
 *   Main column (left):
 *     - "Move and improve" callout (the guide's ! reminder)
 *     - TS  role-label → working TS context + Final TS (autosave)
 *     - For has_counterargument: final concession / counter / refutation
 *     - Per chunk: CD role-label + cd_sentences[]  ·  CM role-label +
 *       cm_sentences[] (CM suppressed for the 3+:0 summary ratio), plus a
 *       non-blocking "once you use it, you lose it" repetition nudge
 *     - CS  role-label → working CS context + Final CS (autosave)
 *     - Notes
 *
 *   Side column (right):
 *     - Pick-n-stitch panel (sits ALONGSIDE the labeled-box column, not
 *       instead of it). Filtered by mode:
 *         Expository / Argumentation: kind='sentence' CMs (t-chart drafts)
 *         Literary: kind='phrase' CMs (cloud phrases from elaboration)
 */

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { PickNStitchPanel } from "./pick-n-stitch-panel";
import { RoleShapeLabel, type ShapeRole } from "@/components/jswp-color/role-shape";
import { findRepeatedContentWords } from "@/lib/once-you-lose-it";
import {
  updateShapingSheet,
  updateChunkOutputCdSentences,
  updateChunkOutputCmSentences,
} from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type {
  ShapingBpData,
  ShapingChunkData,
} from "@/lib/queries/shaping";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

const ROLE_COLOR_VAR: Record<ShapeRole, string> = {
  ts: "var(--jswp-color-ts)",
  cd: "var(--jswp-color-cd)",
  cm: "var(--jswp-color-cm)",
  cs: "var(--jswp-color-cs)",
};

// Static literal classes so Tailwind's content scanner generates them
// (a dynamically built `text-[color:${var}]` string would not register).
const ROLE_TEXT_CLASS: Record<ShapeRole, string> = {
  ts: "text-[color:var(--jswp-color-ts)]",
  cd: "text-[color:var(--jswp-color-cd)]",
  cm: "text-[color:var(--jswp-color-cm)]",
  cs: "text-[color:var(--jswp-color-cs)]",
};

export function CdCmShapingBpPane({
  writingId,
  bp,
  mode,
  hasCounterargument,
}: {
  writingId: string;
  bp: ShapingBpData;
  mode: Mode;
  hasCounterargument: boolean;
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

  // Side-panel CM filter: Literary uses phrases; others use sentences.
  const stitchKind = mode === "literary" ? "phrase" : "sentence";
  const stitchCms = bp.chunks.flatMap((c) =>
    c.cms.filter((cm) => cm.kind === stitchKind)
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* Main column */}
      <div className="space-y-5 min-w-0">
        <MovesAndImprovesCallout />

        <RevisionMovesChecklist
          writingId={writingId}
          sheetId={ss.id}
          initial={ss.revision_moves ?? []}
        />

        {/* Topic Sentence */}
        <Section role="ts" title="Topic Sentence">
          {bp.working_topic_sentence && (
            <ReadOnlyContext label="Working TS (from t-chart)">
              {bp.working_topic_sentence}
            </ReadOnlyContext>
          )}
          <Field label="Final TS" help="Move and improve. Apply grammar rules.">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={ss.final_topic_sentence ?? ""}
              placeholder="Write the polished topic sentence…"
              disabled={isReadOnly}
              className="text-[color:var(--jswp-color-ts)]"
              onSave={async (final_topic_sentence) => {
                await updateShapingSheet(writingId, ss.id, {
                  final_topic_sentence,
                });
              }}
            />
          </Field>
        </Section>

        {/* Counterargument finals (argumentation only with has_counterargument) */}
        {hasCounterargument && (
          <PlainSection title="Concession / Counterargument / Refutation">
            <Field label="Final concession">
              <AutoSaveInput
                multiline
                rows={2}
                initialValue={ss.final_concession ?? ""}
                disabled={isReadOnly}
                onSave={async (final_concession) => {
                  await updateShapingSheet(writingId, ss.id, {
                    final_concession,
                  });
                }}
              />
            </Field>
            <Field label="Final counterargument">
              <AutoSaveInput
                multiline
                rows={2}
                initialValue={ss.final_counterargument ?? ""}
                disabled={isReadOnly}
                onSave={async (final_counterargument) => {
                  await updateShapingSheet(writingId, ss.id, {
                    final_counterargument,
                  });
                }}
              />
            </Field>
            <Field label="Final refutation">
              <AutoSaveInput
                multiline
                rows={2}
                initialValue={ss.final_refutation ?? ""}
                disabled={isReadOnly}
                onSave={async (final_refutation) => {
                  await updateShapingSheet(writingId, ss.id, {
                    final_refutation,
                  });
                }}
              />
            </Field>
          </PlainSection>
        )}

        {/* Chunks: per-chunk woven CD/CM sentence arrays */}
        {bp.chunks.map((chunk) => (
          <ChunkSection key={chunk.id} writingId={writingId} chunk={chunk} />
        ))}

        {/* Concluding Sentence */}
        <Section role="cs" title="Concluding Sentence">
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
              className="text-[color:var(--jswp-color-cs)]"
              onSave={async (final_concluding_sentence) => {
                await updateShapingSheet(writingId, ss.id, {
                  final_concluding_sentence,
                });
              }}
            />
          </Field>
        </Section>

        {/* Notes */}
        <PlainSection title="Notes">
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={ss.notes ?? ""}
            placeholder="Anything to remember about this paragraph's shaping…"
            disabled={isReadOnly}
            onSave={async (notes) => {
              await updateShapingSheet(writingId, ss.id, { notes });
            }}
          />
        </PlainSection>
      </div>

      {/* Side column: pick-n-stitch */}
      <aside className="lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
        <PickNStitchPanel
          writingId={writingId}
          cms={stitchCms}
          emptyMessage={
            mode === "literary"
              ? "No elaboration phrases yet — go back to Elaboration to add some."
              : "No CMs yet — go back to the t-chart to add CM sentences."
          }
        />
      </aside>
    </div>
  );
}

/* ─── "Move and improve" callout (the guide's ! reminder) ─────────── */

function MovesAndImprovesCallout() {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-semibold">Move and improve.</span> Don&apos;t just
      copy your T-Chart — revise each sentence and underline every change.
      Remember: <em>once you use a word, you lose it</em> — try not to repeat
      the same word across sentences in a chunk.
    </div>
  );
}

/* ─── Five-move revision checklist (guide glossary pp.151-152) ──────────
   Non-blocking self-check. Move keys persist to shaping_sheets.revision_moves
   (separate from rules_applied, which is reserved for the 15 Grammar Rules). */

const REVISION_MOVES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "transitions", label: "Add transitions between ideas" },
  { key: "vary_openings", label: "Vary your sentence openings" },
  {
    key: "sentence_types",
    label:
      "Use different sentence types (simple, compound, complex, compound-complex)",
  },
  { key: "mechanics", label: "Fix spelling, punctuation, and capitalization" },
  { key: "voice", label: "Add or delete words to create your voice" },
];

function RevisionMovesChecklist({
  writingId,
  sheetId,
  initial,
}: {
  writingId: string;
  sheetId: string;
  initial: readonly string[];
}) {
  const { isReadOnly } = useWritingMode();
  const [moves, setMoves] = useState<readonly string[]>(initial);
  const [pending, start] = useTransition();

  const toggle = (key: string) => {
    const prev = moves;
    const next = prev.includes(key)
      ? prev.filter((m) => m !== key)
      : [...prev, key];
    setMoves(next); // optimistic
    start(async () => {
      try {
        await updateShapingSheet(writingId, sheetId, { revision_moves: [...next] });
      } catch (e) {
        console.error("revision_moves toggle:", e);
        setMoves(prev); // revert on failure
      }
    });
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
        Revision checklist
      </h3>
      <p className="text-xs text-gray-500">
        Check each move as you make it — your self-check, not a gate.
      </p>
      <ul className="space-y-1.5">
        {REVISION_MOVES.map((m) => (
          <li key={m.key}>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={moves.includes(m.key)}
                onChange={() => toggle(m.key)}
                disabled={isReadOnly || pending}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
                style={{ accentColor: "var(--district-primary)" }}
              />
              <span>{m.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Per-chunk section: cd_sentences[] + cm_sentences[] lists ───── */

function ChunkSection({
  writingId,
  chunk,
}: {
  writingId: string;
  chunk: ShapingChunkData;
}) {
  // 3+:0 (summary) has no commentary — suppress the CM box entirely.
  const isSummaryRatio = chunk.ratio === "three_plus_to_zero";

  if (!chunk.output) {
    return (
      <PlainSection title={`Chunk ${chunk.position}`}>
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          Chunk output not bootstrapped. Reload to retry.
        </div>
      </PlainSection>
    );
  }

  const repeated = findRepeatedContentWords([
    ...chunk.output.cd_sentences,
    ...(isSummaryRatio ? [] : chunk.output.cm_sentences),
  ]);

  return (
    <PlainSection title={`Chunk ${chunk.position}`}>
      <SentenceList
        role="cd"
        label="CD sentences"
        helpText="Final concrete-detail sentences for this chunk."
        sentences={chunk.output.cd_sentences}
        onSave={async (next) => {
          await updateChunkOutputCdSentences(writingId, chunk.output!.id, next);
        }}
      />
      {!isSummaryRatio && (
        <SentenceList
          role="cm"
          label="CM sentences"
          helpText="Final commentary sentences. Mark which CMs you stitched in via the side panel."
          sentences={chunk.output.cm_sentences}
          onSave={async (next) => {
            await updateChunkOutputCmSentences(
              writingId,
              chunk.output!.id,
              next
            );
          }}
        />
      )}
      {repeated.length > 0 && <RepeatNudge words={repeated.map((r) => r.word)} />}
    </PlainSection>
  );
}

function RepeatNudge({ words }: { words: readonly string[] }) {
  const shown = words.slice(0, 6);
  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
      role="status"
    >
      <span className="font-semibold">Once you use it, you lose it:</span>{" "}
      {shown.map((w, i) => (
        <span key={w}>
          <span className="font-mono">{w}</span>
          {i < shown.length - 1 ? ", " : ""}
        </span>
      ))}{" "}
      {words.length > shown.length && `(+${words.length - shown.length} more) `}
      appear{shown.length === 1 && words.length === 1 ? "s" : ""} in more than
      one sentence. Consider rewording.
    </div>
  );
}

function SentenceList({
  role,
  label,
  helpText,
  sentences,
  onSave,
}: {
  role: ShapeRole;
  label: string;
  helpText: string;
  sentences: readonly string[];
  onSave: (next: string[]) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const colorVar = ROLE_COLOR_VAR[role];
  const textClass = ROLE_TEXT_CLASS[role];

  const updateAt = (i: number, value: string): string[] => {
    const next = sentences.slice();
    next[i] = value;
    return next;
  };
  const removeAt = (i: number): string[] => {
    const next = sentences.slice();
    next.splice(i, 1);
    return next;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RoleShapeLabel role={role} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: colorVar }}
        >
          {label}
        </span>
      </div>
      <p className="text-xs text-gray-500">{helpText}</p>
      {sentences.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          No sentences yet. Click [Add sentence] to start.
        </p>
      )}
      {sentences.map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <AutoSaveInput
              multiline
              rows={2}
              initialValue={s}
              disabled={isReadOnly}
              className={textClass}
              onSave={async (value) => {
                await onSave(updateAt(i, value));
              }}
            />
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => start(async () => onSave(removeAt(i)))}
              disabled={pending}
              title="Remove sentence"
              className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button
          type="button"
          onClick={() => start(async () => onSave([...sentences, ""]))}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add sentence
        </button>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Section whose title is introduced by a JSWP color/shape role-label. */
function Section({
  role,
  title,
  children,
}: {
  role: ShapeRole;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RoleShapeLabel role={role} />
        <h3
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: ROLE_COLOR_VAR[role] }}
        >
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

/** Section with a plain (non-role) heading — chunks, C/CA/R, notes. */
function PlainSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
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
