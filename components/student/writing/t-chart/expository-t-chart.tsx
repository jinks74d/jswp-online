"use client";

/**
 * Expository T-Chart — the guide's "T" layout (chunk 4.5d-2).
 *
 *   ┌ STEP n: COMPLETING THE T-CHART ─────────────┐
 *   │ TS:          [full-width, blue]             │
 *   │ Revised TS:  [full-width, blue]  (2+:1 only)│
 *   ├──────────────────┬──────────────────────────┤
 *   │ CDs (red)        │ CMs (green)              │  per-chunk grid
 *   ├──────────────────┴──────────────────────────┤
 *   │ CS:          [full-width, blue]             │
 *   └─────────────────────────────────────────────┘
 *
 * Expository-only. argumentation + literary still render through
 * CdCmTChart / chunk-editor — see t-chart-client's dispatch branch;
 * those two files are deliberately untouched. The 3+:0 (summary)
 * variant drops the Revised TS row and the CM column (the per-chunk
 * CM suppression lives in ExpositoryChunkGrid). Layout/spec config
 * is resolved by lib/expository-t-chart-spec.ts.
 */

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import { ExpositoryChunkGrid, OrderBadge } from "./expository-chunk-grid";
import { updateTChart, addChunk, removeChunk } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import { getExpositoryTChartSpec } from "@/lib/expository-t-chart-spec";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

export function ExpositoryTChart({
  writingId,
  bp,
  mode,
  writingChunkRatio,
}: {
  writingId: string;
  bp: BodyParagraphData;
  mode: Mode;
  writingChunkRatio: ChunkRatio;
}) {
  const { isReadOnly } = useWritingMode();
  const spec = getExpositoryTChartSpec(writingChunkRatio);

  if (!bp.t_chart) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        T-chart not yet bootstrapped for this body paragraph. Reload the
        page to retry.
      </div>
    );
  }
  const tc = bp.t_chart;

  return (
    <div className="space-y-4">
      {/* Guide-style header band */}
      <header>
        <div className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white">
          Step {spec.stepNumber}: Completing the T-Chart
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-lg font-bold text-gray-900">T-Chart</h3>
          <span className="text-sm font-medium text-gray-500">
            {spec.ratioLabel}
          </span>
        </div>
      </header>

      {/* Topic Sentence — full-width row */}
      <BlueRow
        badge={spec.badges.ts}
        label={spec.tsLabel}
        initialValue={tc.working_topic_sentence ?? ""}
        placeholder="Write the topic sentence for this paragraph…"
        disabled={isReadOnly}
        onSave={async (working_topic_sentence) => {
          await updateTChart(writingId, tc.id, { working_topic_sentence });
        }}
      />

      {/* Revised Topic Sentence — full-width row, 2+:1 only */}
      {spec.showRevisedTs && (
        <BlueRow
          badge={spec.badges.revised_ts}
          label="Revised TS:"
          initialValue={tc.revised_topic_sentence ?? ""}
          placeholder="Revise your topic sentence using unused CM words…"
          disabled={isReadOnly}
          onSave={async (revised_topic_sentence) => {
            await updateTChart(writingId, tc.id, { revised_topic_sentence });
          }}
        />
      )}

      {/* Chunks — the two-column CD | CM grid */}
      <div className="space-y-3">
        {bp.chunks.map((chunk, i) => (
          <ExpositoryChunkGrid
            key={chunk.id}
            writingId={writingId}
            chunk={chunk}
            mode={mode}
            chunkNumber={i + 1}
            totalChunks={bp.chunks.length}
            cdsBadge={spec.badges.cds}
            cmsBadge={spec.badges.cms}
            onRemove={() => {
              void removeChunk(writingId, chunk.id);
            }}
          />
        ))}
        {!isReadOnly && (
          <AddChunkButton
            writingId={writingId}
            bodyParagraphId={bp.id}
            mode={mode}
            ratio={writingChunkRatio}
          />
        )}
      </div>

      {/* Concluding Sentence — full-width row */}
      <BlueRow
        badge={spec.badges.cs}
        label={spec.csLabel}
        initialValue={tc.concluding_sentence ?? ""}
        placeholder="Write the concluding sentence…"
        disabled={isReadOnly}
        onSave={async (concluding_sentence) => {
          await updateTChart(writingId, tc.id, { concluding_sentence });
        }}
      />
    </div>
  );
}

/* ─── Full-width blue row (TS / Revised TS / CS) ──────────────────── */

function BlueRow({
  badge,
  label,
  initialValue,
  placeholder,
  disabled,
  onSave,
}: {
  badge?: number;
  label: string;
  initialValue: string;
  placeholder: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  return (
    <div
      className="rounded-lg border border-l-4 border-gray-200 bg-white p-3"
      style={{ borderLeftColor: "var(--jswp-color-ts)" }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {badge !== undefined && <OrderBadge n={badge} />}
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--jswp-color-ts)" }}
        >
          <span aria-hidden="true">● </span>
          {label}
        </span>
      </div>
      <AutoSaveInput
        multiline
        rows={2}
        initialValue={initialValue}
        placeholder={placeholder}
        disabled={disabled}
        className="text-[color:var(--jswp-color-ts)]"
        onSave={onSave}
      />
    </div>
  );
}

/* ─── Add-chunk button ────────────────────────────────────────────── */

function AddChunkButton({
  writingId,
  bodyParagraphId,
  mode,
  ratio,
}: {
  writingId: string;
  bodyParagraphId: string;
  mode: Mode;
  ratio: ChunkRatio;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await addChunk(writingId, bodyParagraphId, mode, ratio);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Add chunk
    </button>
  );
}
