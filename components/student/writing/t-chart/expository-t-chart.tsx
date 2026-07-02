"use client";

/**
 * Expository T-Chart — restyled to mirror the printed JSWP "T-Chart
 * Worksheet" (design base: T-Chart Worksheet.html). The artifact now reads
 * like the paper sheet students use: a white page on the app's gray canvas,
 * ruled writing lines, a centered T-CHART title, blue TOPIC / REVISED TOPIC /
 * COMMENTARY sentences, a red-CDs | green-CMs "T" with black rules, and the
 * commentary rendered as green "clouds" (ovals with rays).
 *
 *   ┌────────────── T-CHART · (2+:1) ──────────────┐
 *   │ PROMPT / TOPIC SENTENCE  [blue, ruled]        │
 *   │ REVISED TOPIC SENTENCE   [blue] (2+:1 only)   │
 *   ├──────────────────┬────────────────────────────┤
 *   │ CDs (red)        │ CMs (green clouds)          │  per-chunk grid
 *   ├──────────────────┴────────────────────────────┤
 *   │ COMMENTARY / CONCLUDING SENTENCE  [blue]      │
 *   └───────────────────────────────────────────────┘
 *
 * Expository-only. argumentation + literary still render through
 * CdCmTChart / chunk-editor — untouched. The 3+:0 (summary) variant drops
 * the Revised TS row and the CM clouds (per-chunk suppression lives in
 * ExpositoryChunkGrid). Layout/spec config resolves from
 * lib/expository-t-chart-spec.ts. All editing stays on AutoSaveInput +
 * server actions; the worksheet look is presentation only.
 */

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import { ExpositoryChunkGrid } from "./expository-chunk-grid";
import { RULED_FIELD, chunkCountWord } from "./worksheet-style";
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
    <div className="bg-[#e9eaed] px-2 py-6 sm:px-6">
      {/* The "paper" sheet */}
      <div className="mx-auto max-w-[816px] rounded-sm bg-white px-6 py-8 shadow-[0_8px_30px_rgba(20,24,40,0.14),0_1px_2px_rgba(20,24,40,0.08)] sm:px-14 sm:py-10">
        {/* Title */}
        <header className="text-center">
          <h3 className="text-2xl font-extrabold uppercase leading-tight tracking-tight text-gray-900">
            T-Chart
          </h3>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {chunkCountWord(bp.chunks.length)} · {spec.ratioLabel} · Step{" "}
            {spec.stepNumber}
          </p>
        </header>

        <div className="mt-7 space-y-5">
          {/* Topic Sentence */}
          <SentenceRow
            label={spec.tsLabel}
            initialValue={tc.working_topic_sentence ?? ""}
            placeholder="Write the topic sentence for this paragraph…"
            disabled={isReadOnly}
            onSave={async (working_topic_sentence) => {
              await updateTChart(writingId, tc.id, { working_topic_sentence });
            }}
          />

          {/* Revised Topic Sentence — 2+:1 only */}
          {spec.showRevisedTs && (
            <SentenceRow
              label="Revised Topic Sentence:"
              initialValue={tc.revised_topic_sentence ?? ""}
              placeholder="Revise your topic sentence using unused CM words…"
              disabled={isReadOnly}
              onSave={async (revised_topic_sentence) => {
                await updateTChart(writingId, tc.id, { revised_topic_sentence });
              }}
            />
          )}

          {/* Chunks — the two-column CD | CM "T" */}
          <div className="space-y-4">
            {bp.chunks.map((chunk, i) => (
              <ExpositoryChunkGrid
                key={chunk.id}
                writingId={writingId}
                chunk={chunk}
                mode={mode}
                chunkNumber={i + 1}
                totalChunks={bp.chunks.length}
                showHeader={i === 0}
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

          {/* Concluding Sentence */}
          <SentenceRow
            label={spec.csLabel === "CS:" ? "Concluding Sentence:" : spec.csLabel}
            initialValue={tc.concluding_sentence ?? ""}
            placeholder="Write the concluding sentence…"
            disabled={isReadOnly}
            onSave={async (concluding_sentence) => {
              await updateTChart(writingId, tc.id, { concluding_sentence });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Blue ruled sentence row (TS / Revised TS / CS) ──────────────────
   Inline bold label on a "sticky note" white chip, then the writing on
   ruled paper lines — the worksheet's TOPIC SENTENCE / COMMENTARY rows.
   Blue is the JSWP TS/CS colour; the ● glyph is the non-colour signal. */

function SentenceRow({
  label,
  initialValue,
  placeholder,
  disabled,
  onSave,
}: {
  label: string;
  initialValue: string;
  placeholder: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span aria-hidden="true" className="text-[color:var(--jswp-color-ts)]">
          ●
        </span>
        <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--jswp-color-ts)]">
          {label}
        </span>
      </div>
      <AutoSaveInput
        bare
        multiline
        rows={2}
        initialValue={initialValue}
        placeholder={placeholder}
        disabled={disabled}
        className={`${RULED_FIELD} text-[color:var(--jswp-color-ts)]`}
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
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      Add chunk
    </button>
  );
}
