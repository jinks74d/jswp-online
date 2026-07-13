"use client";

/**
 * One Expository chunk rendered as the worksheet's CD | CM "T" (design base:
 * T-Chart Worksheet.html). Left column: red concrete details, each headed
 * "Nth CHUNK, Nth CD:". Right column: green commentary "clouds" (ovals with
 * rays) — one per CD. A black top bar + under-header rule + a vertical stem
 * between the columns form the T; the header row (CDs / CMs) renders once, on
 * the first chunk.
 *
 * For 3+:0 (summary) the CM clouds are suppressed — a summary has no
 * commentary — and the right column shows a quiet placeholder.
 *
 * Data flow is unchanged from the pre-restyle grid: createConcreteDetail /
 * createCommentaryItem(parentCdId) / update / delete are identical to the
 * shared chunk-editor's. The CD text + Embedding-Quotations affordance stays
 * in the shared <CdEditor>. chunk-editor.tsx and cd-cm-t-chart.tsx are
 * untouched so argumentation and literary render exactly as before.
 */

import { useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { CdEditor } from "./cd-editor";
import { CmCloud } from "./cm-cloud";
import { WORKSHEET_INK, ordinal } from "./worksheet-style";
import { ratioClass } from "@/lib/jswp-modes";
import {
  createConcreteDetail,
  deleteConcreteDetail,
  createCommentaryItem,
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

/* ─── Chunk grid ──────────────────────────────────────────────────── */

export function ExpositoryChunkGrid({
  writingId,
  chunk,
  mode,
  chunkNumber,
  totalChunks,
  showHeader,
  onRemove,
}: {
  writingId: string;
  chunk: ChunkData;
  mode: Mode;
  chunkNumber: number;
  totalChunks: number;
  /** Render the CDs / CMs header band (only the first chunk does). */
  showHeader: boolean;
  onRemove: () => void;
}) {
  const { isReadOnly } = useWritingMode();
  const isSummaryRatio = ratioClass(chunk.ratio) === "three_plus_to_zero";
  const cds = chunk.concrete_details;

  return (
    <section>
      {totalChunks > 1 && (
        <header className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {ordinal(chunkNumber)} Chunk
          </span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove chunk
            </button>
          )}
        </header>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2">
        {showHeader && (
          <>
            <ColumnHeader role="cd" label="CDs" />
            <ColumnHeader
              role="cm"
              label="CMs"
              subtitle={
                isSummaryRatio ? undefined : "(This is/was important because…) Why?"
              }
            />
          </>
        )}

        {isSummaryRatio ? (
          <>
            {/* CDs column */}
            <div className="space-y-4 py-4 sm:pr-5">
              {cds.map((cd, i) => (
                <CdCell
                  key={cd.id}
                  writingId={writingId}
                  cd={cd}
                  chunkNumber={chunkNumber}
                  cdNumber={i + 1}
                  disabled={isReadOnly}
                  canDelete={cds.length > 1}
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
            {/* Empty CMs column */}
            <div className="hidden items-center justify-center border-l-2 border-black p-4 sm:flex">
              <p className="max-w-[220px] text-center text-xs italic text-gray-400">
                No commentary in a 3+:0 summary — the CMs side stays empty.
              </p>
            </div>
          </>
        ) : (
          cds.map((cd, i) => (
            <CdCmRow
              key={cd.id}
              writingId={writingId}
              chunkId={chunk.id}
              cd={cd}
              chunkNumber={chunkNumber}
              cdNumber={i + 1}
              cms={chunk.commentary_items.filter(
                (c) => c.parent_cd_id === cd.id && c.kind === "sentence"
              )}
              disabled={isReadOnly}
              canDelete={cds.length > 1}
            />
          ))
        )}

        {!isReadOnly && !isSummaryRatio && (
          <>
            <div className="pt-1 sm:pr-5">
              <AddCdButton
                writingId={writingId}
                chunkId={chunk.id}
                mode={mode}
                ratio={chunk.ratio}
              />
            </div>
            <div className="border-l-2 border-black" aria-hidden="true" />
          </>
        )}
      </div>
    </section>
  );
}

/* ─── Column header (red CDs / green CMs, black rules) ────────────── */

function ColumnHeader({
  role,
  label,
  subtitle,
}: {
  role: "cd" | "cm";
  label: string;
  subtitle?: string;
}) {
  const color = role === "cd" ? WORKSHEET_INK.cd : WORKSHEET_INK.cm;
  const symbol = role === "cd" ? "▲" : "■";
  return (
    <div
      className={`border-y-2 border-black px-3 py-2 text-center ${
        role === "cm" ? "sm:border-l-2" : ""
      }`}
    >
      <div
        className="text-xl font-extrabold leading-tight"
        style={{ color }}
      >
        <span aria-hidden="true" className="mr-1 align-middle text-sm">
          {symbol}
        </span>
        {label}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[11px] leading-tight text-gray-500">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* ─── CD cell (single-column 3+:0 variant) ────────────────────────── */

function CdCell({
  writingId,
  cd,
  chunkNumber,
  cdNumber,
  disabled,
  canDelete,
}: {
  writingId: string;
  cd: ConcreteDetailData;
  chunkNumber: number;
  cdNumber: number;
  disabled: boolean;
  canDelete: boolean;
}) {
  return (
    <div>
      <CdHeading chunkNumber={chunkNumber} cdNumber={cdNumber} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <CdEditor writingId={writingId} cd={cd} disabled={disabled} />
        </div>
        {!disabled && canDelete && (
          <DeleteButton
            title="Remove CD"
            onConfirm={() => deleteConcreteDetail(writingId, cd.id)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── CD + aligned CM cloud (two-column 2+:1 variant) ─────────────── */

function CdCmRow({
  writingId,
  chunkId,
  cd,
  chunkNumber,
  cdNumber,
  cms,
  disabled,
  canDelete,
}: {
  writingId: string;
  chunkId: string;
  cd: ConcreteDetailData;
  chunkNumber: number;
  cdNumber: number;
  cms: CommentaryItemData[];
  disabled: boolean;
  canDelete: boolean;
}) {
  return (
    <>
      {/* Column 1 — the concrete detail */}
      <div className="py-4 sm:pr-5">
        <CdHeading chunkNumber={chunkNumber} cdNumber={cdNumber} />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CdEditor writingId={writingId} cd={cd} disabled={disabled} />
          </div>
          {!disabled && canDelete && (
            <DeleteButton
              title="Remove CD"
              onConfirm={() => deleteConcreteDetail(writingId, cd.id)}
            />
          )}
        </div>
      </div>

      {/* Column 2 — one commentary cloud per CM (1 in the oval, 4 on the rays) */}
      <div className="space-y-4 border-l-2 border-black py-4 sm:pl-5">
        {cms.map((cm) => (
          <CmCloud
            key={cm.id}
            writingId={writingId}
            cm={cm}
            onDelete={
              disabled
                ? undefined
                : () => deleteCommentaryItem(writingId, cm.id)
            }
          />
        ))}
        {!disabled && (
          <div className="text-center">
            <AddCmButton
              writingId={writingId}
              chunkId={chunkId}
              parentCdId={cd.id}
            />
          </div>
        )}
      </div>
    </>
  );
}

/* ─── CD heading ("1st CHUNK, 2nd CD:") ───────────────────────────── */

function CdHeading({
  chunkNumber,
  cdNumber,
}: {
  chunkNumber: number;
  cdNumber: number;
}) {
  return (
    <div
      className="mb-1.5 text-center text-sm font-bold uppercase tracking-wide"
      style={{ color: WORKSHEET_INK.cd }}
    >
      <span aria-hidden="true" className="mr-1 text-xs">
        ▲
      </span>
      {ordinal(chunkNumber)} Chunk, {ordinal(cdNumber)} CD:
    </div>
  );
}

/* ─── Buttons ─────────────────────────────────────────────────────── */

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
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
      style={{ color: WORKSHEET_INK.cd }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs hover:bg-emerald-50 disabled:opacity-50"
      style={{ color: WORKSHEET_INK.cm }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Add CM
    </button>
  );
}

function DeleteButton({
  title,
  onConfirm,
  small,
}: {
  title: string;
  onConfirm: () => Promise<void> | void;
  small?: boolean;
}) {
  const [pending, start] = useTransition();
  const size = small ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() =>
        start(async () => {
          await onConfirm();
        })
      }
      disabled={pending}
      className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className={`${size} animate-spin`} aria-hidden="true" />
      ) : (
        <Trash2 className={size} aria-hidden="true" />
      )}
    </button>
  );
}
