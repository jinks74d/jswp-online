"use client";

/**
 * One body paragraph's T-chart for expository / argumentation /
 * literary modes. Layout (top to bottom):
 *
 *   - Working Topic Sentence (textarea, autosave)
 *   - Chunks list (one chunk-editor each, with CDs and CMs)
 *   - [+] Add chunk
 *   - Concluding Sentence (textarea, autosave)
 *
 * The "revised topic sentence" column from the schema lives on the
 * Shaping Sheet step (chunk 4.5+); we don't expose it here. Same
 * for Argumentation's concession/counterargument/refutation — those
 * belong to the separate argumentation.counterargument step.
 */

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import { ChunkEditor } from "./chunk-editor";
import {
  updateTChart,
  addChunk,
  removeChunk,
} from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

export function CdCmTChart({
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
    <div className="space-y-5">
      {/* Working topic sentence */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
          Working Topic Sentence
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Your first attempt — you&apos;ll move and improve it on the
          Shaping Sheet.
        </p>
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={tc.working_topic_sentence ?? ""}
          placeholder="Write the topic sentence for this paragraph…"
          disabled={isReadOnly}
          onSave={async (working_topic_sentence) => {
            await updateTChart(writingId, tc.id, { working_topic_sentence });
          }}
        />
      </div>

      {/* Chunks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Chunks ({bp.chunks.length})
          </h3>
        </div>
        {bp.chunks.map((chunk, i) => (
          <ChunkEditor
            key={chunk.id}
            writingId={writingId}
            chunk={chunk}
            mode={mode}
            chunkNumber={i + 1}
            totalChunks={bp.chunks.length}
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

      {/* Concluding sentence */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
          Concluding Sentence
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Brings the paragraph to a close — also written in blue, like the TS.
        </p>
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={tc.concluding_sentence ?? ""}
          placeholder="Write the concluding sentence…"
          disabled={isReadOnly}
          onSave={async (concluding_sentence) => {
            await updateTChart(writingId, tc.id, { concluding_sentence });
          }}
        />
      </div>
    </div>
  );
}

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
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      Add chunk
    </button>
  );
}
