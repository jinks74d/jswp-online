"use client";

/**
 * One body paragraph's shaping pane for expository / argumentation /
 * literary modes. Layout:
 *
 *   Main column (left):
 *     - Working TS (read-only) + Final TS (autosave)
 *     - For has_counterargument: final concession / counter / refutation
 *     - Per chunk: cd_sentences[] list-with-add + cm_sentences[] list-with-add
 *     - Working CS (read-only) + Final CS (autosave)
 *     - Notes
 *
 *   Side column (right):
 *     - Pick-n-stitch panel showing CMs to stitch from. Filtered by mode:
 *         Expository / Argumentation: kind='sentence' CMs (drafts from t-chart)
 *         Literary: kind='phrase' CMs (cloud phrases from elaboration)
 */

import { useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { PickNStitchPanel } from "./pick-n-stitch-panel";
import {
  updateShapingSheet,
  updateChunkOutputCdSentences,
  updateChunkOutputCmSentences,
} from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type {
  ShapingBpData,
  ShapingChunkData,
  ChunkOutputData,
} from "@/lib/queries/shaping";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

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
        {/* Topic Sentence */}
        <Section title="Topic Sentence">
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
          <Section title="Concession / Counterargument / Refutation">
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
          </Section>
        )}

        {/* Chunks: per-chunk woven CD/CM sentence arrays */}
        {bp.chunks.map((chunk) => (
          <ChunkSection
            key={chunk.id}
            writingId={writingId}
            chunk={chunk}
          />
        ))}

        {/* Concluding Sentence */}
        <Section title="Concluding Sentence">
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

        {/* Notes */}
        <Section title="Notes">
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
        </Section>
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

/* ─── Per-chunk section: cd_sentences[] + cm_sentences[] lists ───── */

function ChunkSection({
  writingId,
  chunk,
}: {
  writingId: string;
  chunk: ShapingChunkData;
}) {
  if (!chunk.output) {
    return (
      <Section title={`Chunk ${chunk.position}`}>
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          Chunk output not bootstrapped. Reload to retry.
        </div>
      </Section>
    );
  }

  return (
    <Section title={`Chunk ${chunk.position}`}>
      <SentenceList
        label="CD sentences"
        accentClass="text-red-700"
        helpText="Final concrete-detail sentences for this chunk."
        sentences={chunk.output.cd_sentences}
        onSave={async (next) => {
          await updateChunkOutputCdSentences(
            writingId,
            chunk.output!.id,
            next
          );
        }}
      />
      <SentenceList
        label="CM sentences"
        accentClass="text-green-700"
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
    </Section>
  );
}

function SentenceList({
  label,
  accentClass,
  helpText,
  sentences,
  onSave,
}: {
  label: string;
  accentClass: string;
  helpText: string;
  sentences: readonly string[];
  onSave: (next: string[]) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();

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
      <div className={`text-xs font-semibold uppercase tracking-wide ${accentClass}`}>
        {label}
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

function Section({
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
