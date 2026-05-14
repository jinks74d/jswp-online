"use client";

/**
 * One Expository chunk rendered as the guide's CD | CM two-column grid
 * (chunk 4.5d-2). For 2+:1 each CD sits in grid column 1 with its
 * commentary in the aligned column-2 cell — CSS grid keeps the rows
 * level. For 3+:0 (summary) only the single CDs column renders; the
 * CM column is suppressed entirely, consistent with chunk 4.5d-1.
 *
 * CMs stay grouped by parent CD: every server-action call
 * (createConcreteDetail, createCommentaryItem with parentCdId,
 * update/delete*) is identical to the shared chunk-editor's — this is
 * a layout re-placement, not a data change. chunk-editor.tsx and
 * cd-cm-t-chart.tsx are deliberately untouched so argumentation and
 * literary T-Charts render exactly as before.
 */

import { useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import {
  createConcreteDetail,
  updateConcreteDetail,
  deleteConcreteDetail,
  createCommentaryItem,
  updateCommentaryItem,
  deleteCommentaryItem,
} from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type {
  ChunkData,
  ConcreteDetailData,
  CommentaryItemData,
} from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

/* ─── Numbered order badge (shared with expository-t-chart) ────────── */

export function OrderBadge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white"
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

/* ─── Chunk grid ──────────────────────────────────────────────────── */

export function ExpositoryChunkGrid({
  writingId,
  chunk,
  mode,
  chunkNumber,
  totalChunks,
  cdsBadge,
  cmsBadge,
  onRemove,
}: {
  writingId: string;
  chunk: ChunkData;
  mode: Mode;
  chunkNumber: number;
  totalChunks: number;
  cdsBadge?: number;
  cmsBadge?: number;
  onRemove: () => void;
}) {
  const { isReadOnly } = useWritingMode();
  // 3+:0 (summary) has no commentary — render a single CDs column.
  const isSummaryRatio = chunk.ratio === "three_plus_to_zero";
  const cds = chunk.concrete_details;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      {totalChunks > 1 && (
        <header className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Chunk {chunkNumber}
          </span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove chunk
            </button>
          )}
        </header>
      )}

      {isSummaryRatio ? (
        /* 3+:0 — single CDs column, no CM column */
        <div className="space-y-2">
          <ColumnHeader badge={cdsBadge} role="cd" label="CDs" />
          {cds.map((cd) => (
            <CdCell
              key={cd.id}
              writingId={writingId}
              cd={cd}
              disabled={isReadOnly}
            />
          ))}
          {!isReadOnly && (
            <AddCdButton
              writingId={writingId}
              chunkId={chunk.id}
              mode={mode}
              ratio={chunk.ratio}
            />
          )}
        </div>
      ) : (
        /* 2+:1 — two-column CD | CM grid, rows aligned per CD */
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <ColumnHeader badge={cdsBadge} role="cd" label="CDs" />
          <ColumnHeader badge={cmsBadge} role="cm" label="CMs" />
          {cds.map((cd) => (
            <CdCmRow
              key={cd.id}
              writingId={writingId}
              chunkId={chunk.id}
              cd={cd}
              cms={chunk.commentary_items.filter(
                (c) => c.parent_cd_id === cd.id && c.kind === "sentence"
              )}
              disabled={isReadOnly}
            />
          ))}
          {!isReadOnly && (
            <>
              <AddCdButton
                writingId={writingId}
                chunkId={chunk.id}
                mode={mode}
                ratio={chunk.ratio}
              />
              <div aria-hidden="true" />
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Column header pill ──────────────────────────────────────────── */

function ColumnHeader({
  badge,
  role,
  label,
}: {
  badge?: number;
  role: "cd" | "cm";
  label: string;
}) {
  const color =
    role === "cd" ? "var(--jswp-color-cd)" : "var(--jswp-color-cm)";
  const symbol = role === "cd" ? "▲" : "■";
  return (
    <div className="flex items-center gap-2">
      {badge !== undefined && <OrderBadge n={badge} />}
      <span
        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color, borderColor: color }}
      >
        <span aria-hidden="true">{symbol}</span>
        {label}
      </span>
    </div>
  );
}

/* ─── CD cell (single-column 3+:0 variant) ────────────────────────── */

function CdCell({
  writingId,
  cd,
  disabled,
}: {
  writingId: string;
  cd: ConcreteDetailData;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={cd.text}
          placeholder="Write a concrete detail from the text or your knowledge…"
          disabled={disabled}
          className="text-[color:var(--jswp-color-cd)]"
          onSave={async (text) => {
            await updateConcreteDetail(writingId, cd.id, text);
          }}
        />
      </div>
      {!disabled && (
        <DeleteButton
          title="Remove CD"
          onConfirm={() => deleteConcreteDetail(writingId, cd.id)}
        />
      )}
    </div>
  );
}

/* ─── CD + aligned CM group (two-column 2+:1 variant) ─────────────── */

function CdCmRow({
  writingId,
  chunkId,
  cd,
  cms,
  disabled,
}: {
  writingId: string;
  chunkId: string;
  cd: ConcreteDetailData;
  cms: CommentaryItemData[];
  disabled: boolean;
}) {
  return (
    <>
      {/* Column 1 — the concrete detail */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={cd.text}
            placeholder="Write a concrete detail from the text or your knowledge…"
            disabled={disabled}
            className="text-[color:var(--jswp-color-cd)]"
            onSave={async (text) => {
              await updateConcreteDetail(writingId, cd.id, text);
            }}
          />
        </div>
        {!disabled && (
          <DeleteButton
            title="Remove CD"
            onConfirm={() => deleteConcreteDetail(writingId, cd.id)}
          />
        )}
      </div>

      {/* Column 2 — commentary for this CD */}
      <div className="space-y-2">
        {cms.map((cm) => (
          <div key={cm.id} className="flex items-start gap-2">
            <div className="flex-1">
              <AutoSaveInput
                multiline
                rows={2}
                initialValue={cm.text}
                placeholder="Why is this important? What does it mean?"
                disabled={disabled}
                className="text-[color:var(--jswp-color-cm)]"
                onSave={async (text) => {
                  await updateCommentaryItem(writingId, cm.id, text);
                }}
              />
            </div>
            {!disabled && (
              <DeleteButton
                title="Remove CM"
                onConfirm={() => deleteCommentaryItem(writingId, cm.id)}
              />
            )}
          </div>
        ))}
        {!disabled && (
          <AddCmButton
            writingId={writingId}
            chunkId={chunkId}
            parentCdId={cd.id}
          />
        )}
      </div>
    </>
  );
}

/* ─── Local add/delete buttons (kept local so chunk-editor.tsx stays
   100% untouched — see file header) ───────────────────────────────── */

function AddCdButton({
  writingId,
  chunkId,
  mode,
  ratio,
}: {
  writingId: string;
  chunkId: string;
  mode: Mode;
  ratio: ChunkData["ratio"];
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createConcreteDetail(writingId, chunkId, mode, ratio);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
      style={{ color: "var(--jswp-color-cd)" }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      Add CD
    </button>
  );
}

function AddCmButton({
  writingId,
  chunkId,
  parentCdId,
}: {
  writingId: string;
  chunkId: string;
  parentCdId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createCommentaryItem(writingId, chunkId, parentCdId);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
      style={{ color: "var(--jswp-color-cm)" }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      Add CM
    </button>
  );
}

function DeleteButton({
  title,
  onConfirm,
}: {
  title: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      onClick={() =>
        start(async () => {
          await onConfirm();
        })
      }
      disabled={pending}
      className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
