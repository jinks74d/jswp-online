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
 *       non-blocking "when you use it, you lose it" repetition nudge
 *     - CS  role-label → working CS context + Final CS (autosave)
 *     - Notes
 *
 *   Side column (right):
 *     - Pick-n-stitch panel (sits ALONGSIDE the labeled-box column, not
 *       instead of it). Filtered by mode:
 *         Expository / Argumentation: kind='sentence' CMs (t-chart drafts)
 *         Literary: kind='phrase' CMs (cloud phrases from elaboration)
 *       Each of those CMs contributes its oval sentence AND its four ray
 *       words/phrases to the pool — everything in and around the circle
 *       develops the sentences (collectCmEntries, lib/pick-n-stitch.ts).
 */

import { useState, useTransition } from "react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  PickNStitchPanel,
  type StitchGroup,
  type StitchRow,
} from "./pick-n-stitch-panel";
import { SentenceList, ROLE_COLOR_VAR } from "./sentence-list";
import { RoleShapeLabel, type ShapeRole } from "@/components/jswp-color/role-shape";
import { ratioClass } from "@/lib/jswp-modes";
import { collectCmEntries, type StitchEntry } from "@/lib/pick-n-stitch";
import { findRepeatedContentWords } from "@/lib/once-you-lose-it";
import {
  updateShapingSheet,
  updateChunkOutputCdSentences,
  updateChunkOutputCmSentences,
} from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type {
  ShapingBpData,
  ShapingCdData,
  ShapingChunkData,
  ShapingCmData,
} from "@/lib/queries/shaping";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type CmKind = Database["public"]["Enums"]["jswp_cm_kind"];

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

  // The pool is the whole cloud — the oval sentence AND the four ray
  // words/phrases brainstormed around it. collectCmEntries flattens both
  // storage shapes into one list (see lib/pick-n-stitch.ts).
  const stitchRows: StitchRow[] = collectCmEntries(stitchCms).map((entry) =>
    decorate(entry, stitchCms)
  );

  // Literary: group phrases under their best-word CM parent so the student
  // stitches CM1 from word-1's clouds and CM2 from word-2's clouds.
  const literaryGroups: StitchGroup[] | undefined =
    mode === "literary"
      ? bp.chunks
          .flatMap((c) =>
            c.cms.filter(
              (cm) => cm.kind === "word" && cm.is_best_word_for_chunk
            )
          )
          .map((word) => {
            const phrases = stitchCms.filter(
              (p) => p.parent_cm_id === word.id
            );
            return {
              key: word.id,
              heading: word.text,
              subheading: word.synonym,
              rows: collectCmEntries(phrases).map((e) => decorate(e, phrases)),
              emptyMessage: "No elaboration phrases for this word yet.",
            };
          })
      : undefined;

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
            <ReadOnlyContext label="Working TS (from your T-Chart)">
              {bp.working_topic_sentence}
            </ReadOnlyContext>
          )}
          {bp.revised_topic_sentence && (
            <ReadOnlyContext label="Revised TS (from your T-Chart)">
              {bp.revised_topic_sentence}
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
            {bp.concession && (
              <ReadOnlyContext label="Concession (from your T-Chart)">
                {bp.concession}
              </ReadOnlyContext>
            )}
            {bp.counterargument && (
              <ReadOnlyContext label="Counterargument (from your T-Chart)">
                {bp.counterargument}
              </ReadOnlyContext>
            )}
            {bp.refutation && (
              <ReadOnlyContext label="Refutation (from your T-Chart)">
                {bp.refutation}
              </ReadOnlyContext>
            )}
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

        {/* Chunks: the T-Chart's own CDs/CMs as context, then the woven
            CD/CM sentence arrays the student writes from them. */}
        {bp.chunks.map((chunk) => (
          <ChunkSection
            key={chunk.id}
            writingId={writingId}
            chunk={chunk}
            stitchKind={stitchKind}
          />
        ))}

        {/* The T-Chart's own commentary sentence (⑤), between the chunks and
            the CS exactly as it sits on the T-Chart. */}
        {bp.commentary_sentence && (
          <ReadOnlyContext label="Commentary sentence (from your T-Chart)">
            {bp.commentary_sentence}
          </ReadOnlyContext>
        )}

        {/* Concluding Sentence */}
        <Section role="cs" title="Concluding Sentence">
          {bp.concluding_sentence && (
            <ReadOnlyContext label="CS (from your T-Chart)">
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
          rows={stitchRows}
          groups={literaryGroups}
          emptyMessage={
            mode === "literary"
              ? "No elaboration phrases yet — go back to Elaboration to add some."
              : "No commentary yet — go back to the T-Chart and fill in your CM clouds."
          }
        />
      </aside>
    </div>
  );
}

/**
 * Attach the literary "best word" pills to a pool entry. They describe the
 * commentary row itself, so only the oval carries them — a ray phrase is not
 * the picked-best word, it is brainstorming around one.
 */
function decorate(
  entry: StitchEntry,
  cms: readonly ShapingCmData[]
): StitchRow {
  if (entry.slot !== null) return entry;
  const cm = cms.find((c) => c.id === entry.cmId);
  return {
    ...entry,
    isBestForTs: cm?.is_best_word_for_ts ?? false,
    isBestForChunk: cm?.is_best_word_for_chunk ?? false,
  };
}

/* ─── "Move and improve" callout (the guide's ! reminder) ─────────── */

function MovesAndImprovesCallout() {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1.5">
      <p>
        <span className="font-semibold">Move and improve.</span> Don&apos;t just
        copy the sentences from your T-Chart – revise each sentence, adding new
        words and phrases, combining ideas, and revising your sentence
        structure. Work on your grammar rules. Make it better!
      </p>
      <p>
        Below is a &ldquo;Revision Checklist&rdquo; to help you.
      </p>
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
        Check to make sure you have performed the following revision
        techniques:
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
                className="mt-0.5 h-4 w-4 rounded border-gray-500"
                style={{ accentColor: "var(--brand)" }}
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
  stitchKind,
}: {
  writingId: string;
  chunk: ShapingChunkData;
  /** Which CM kind carries this mode's commentary on the T-Chart. */
  stitchKind: CmKind;
}) {
  // 3+:0 (summary) has no commentary — suppress the CM box entirely.
  const isSummaryRatio = ratioClass(chunk.ratio) === "three_plus_to_zero";

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
      <TChartContext
        cds={chunk.cds}
        cms={chunk.cms.filter((cm) => cm.kind === stitchKind)}
        showCms={!isSummaryRatio}
      />
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

/* ─── The chunk's T-Chart, read-only ──────────────────────────────────
   The Shaping Sheet is worked with the T-Chart lying beside it, so every
   piece of that chunk's plan has to be legible here: the CDs (with their
   lead-in and citation when the CD is an embedded quotation) on the left,
   and each CM cloud — the oval sentence plus the words and phrases
   brainstormed around it — on the right. Laid out as the T so it reads as
   the same artifact the student just filled in. */

function TChartContext({
  cds,
  cms,
  showCms,
}: {
  cds: readonly ShapingCdData[];
  cms: readonly ShapingCmData[];
  showCms: boolean;
}) {
  if (cds.length === 0 && cms.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-300 bg-gray-50/70 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        From your T-Chart
      </h4>
      <div className={`grid gap-3 ${showCms ? "sm:grid-cols-2" : ""}`}>
        <div>
          <ContextHeading role="cd" label="CDs" />
          {cds.length === 0 ? (
            <EmptyContext>No CDs on the T-Chart for this chunk.</EmptyContext>
          ) : (
            <ol className="space-y-1.5">
              {cds.map((cd, i) => (
                <li key={cd.id} className="text-sm">
                  <span className="mr-1 text-xs font-semibold text-gray-500">
                    {i + 1}.
                  </span>
                  {cd.transitional_lead_in && (
                    <span className="text-gray-600 italic">
                      {cd.transitional_lead_in}{" "}
                    </span>
                  )}
                  <span className="text-[color:var(--jswp-color-cd)] whitespace-pre-wrap">
                    {cd.text.trim() || (
                      <span className="italic text-gray-500">(empty)</span>
                    )}
                  </span>
                  {cd.source_citation && (
                    <span className="text-gray-600"> ({cd.source_citation})</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {showCms && (
          <div className="sm:border-l sm:border-gray-300 sm:pl-3">
            <ContextHeading role="cm" label="CMs" />
            {cms.length === 0 ? (
              <EmptyContext>
                No commentary on the T-Chart for this chunk.
              </EmptyContext>
            ) : (
              <ul className="space-y-2">
                {cms.map((cm) => (
                  <li key={cm.id}>
                    <p className="text-sm text-[color:var(--jswp-color-cm)] whitespace-pre-wrap">
                      {cm.text.trim() || (
                        <span className="italic text-gray-500">
                          (no commentary sentence)
                        </span>
                      )}
                    </p>
                    <RayChips words={cm.web_words} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The four brainstormed words/phrases from around a CM's oval. */
function RayChips({ words }: { words: readonly string[] | null }) {
  const filled = (words ?? []).map((w) => w.trim()).filter(Boolean);
  if (filled.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {filled.map((w, i) => (
        <li
          key={`${i}-${w}`}
          className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-[color:var(--jswp-color-cm)]"
        >
          {w}
        </li>
      ))}
    </ul>
  );
}

function ContextHeading({
  role,
  label,
}: {
  role: "cd" | "cm";
  label: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <RoleShapeLabel role={role} />
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: ROLE_COLOR_VAR[role] }}
      >
        {label}
      </span>
    </div>
  );
}

function EmptyContext({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-gray-500">{children}</p>;
}

function RepeatNudge({ words }: { words: readonly string[] }) {
  const shown = words.slice(0, 6);
  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
      role="status"
    >
      <span className="font-semibold">When you use it, you lose it:</span>{" "}
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
