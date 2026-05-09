"use client";

/**
 * Renders one chunk: ratio label + N concrete details, with each CD
 * showing its commentary items underneath. Add/remove buttons for
 * CDs and CMs. The CD/CM text fields use AutoSaveInput so saves are
 * background-only — there's no chunk-level save button.
 */

import { useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import {
  updateConcreteDetail,
  deleteConcreteDetail,
  createConcreteDetail,
  updateCommentaryItem,
  deleteCommentaryItem,
  createCommentaryItem,
} from "@/lib/actions/t-charts";
import type {
  ChunkData,
  CommentaryItemData,
  ConcreteDetailData,
} from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

const RATIO_LABELS: Record<ChunkData["ratio"], string> = {
  two_plus_to_one: "2+ : 1",
  one_to_two_plus: "1 : 2+",
  three_plus_to_zero: "3+ : 0",
};

export function ChunkEditor({
  writingId,
  chunk,
  mode,
  chunkNumber,
  totalChunks,
  onRemove,
}: {
  writingId: string;
  chunk: ChunkData;
  mode: Mode;
  chunkNumber: number;
  totalChunks: number;
  onRemove: () => void;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Chunk {chunkNumber}
          </span>
          <span className="text-xs text-gray-500">
            ratio {RATIO_LABELS[chunk.ratio]}
          </span>
        </div>
        {totalChunks > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-gray-500 hover:text-red-700 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove chunk
          </button>
        )}
      </header>

      <div className="p-4 space-y-3">
        {chunk.concrete_details.map((cd) => (
          <CdRow
            key={cd.id}
            writingId={writingId}
            chunk={chunk}
            cd={cd}
            mode={mode}
            canDelete={chunk.concrete_details.length > 0}
          />
        ))}

        <AddCdButton writingId={writingId} chunkId={chunk.id} mode={mode} />
      </div>
    </section>
  );
}

/* ─── Single CD row + its CMs ─────────────────────────────────────── */

function CdRow({
  writingId,
  chunk,
  cd,
  mode,
  canDelete,
}: {
  writingId: string;
  chunk: ChunkData;
  cd: ConcreteDetailData;
  mode: Mode;
  canDelete: boolean;
}) {
  const childCms = chunk.commentary_items.filter(
    (c) => c.parent_cd_id === cd.id
  );

  return (
    <div className="border-l-4 border-red-300 pl-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-2 text-xs font-semibold text-red-700 uppercase">
          CD
        </span>
        <div className="flex-1">
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={cd.text}
            placeholder="Write a concrete detail from the text or your knowledge…"
            onSave={async (text) => {
              await updateConcreteDetail(writingId, cd.id, text);
            }}
          />
        </div>
        {canDelete && (
          <DeleteCdButton writingId={writingId} cdId={cd.id} />
        )}
      </div>

      <div className="ml-6 space-y-2">
        {childCms.map((cm) => (
          <CmRow
            key={cm.id}
            writingId={writingId}
            cm={cm}
          />
        ))}
        <AddCmButton
          writingId={writingId}
          chunkId={chunk.id}
          parentCdId={cd.id}
        />
      </div>
    </div>
  );
}

function CmRow({
  writingId,
  cm,
}: {
  writingId: string;
  cm: CommentaryItemData;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-2 text-xs font-semibold text-green-700 uppercase">
        CM
      </span>
      <div className="flex-1">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={cm.text}
          placeholder="Why is this important? What does it mean?"
          onSave={async (text) => {
            await updateCommentaryItem(writingId, cm.id, text);
          }}
        />
      </div>
      <DeleteCmButton writingId={writingId} cmId={cm.id} />
    </div>
  );
}

/* ─── Add/delete buttons (small, transition-aware) ────────────────── */

function AddCdButton({
  writingId,
  chunkId,
  mode,
}: {
  writingId: string;
  chunkId: string;
  mode: Mode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createConcreteDetail(writingId, chunkId, mode);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      Add CD
    </button>
  );
}

function DeleteCdButton({
  writingId,
  cdId,
}: {
  writingId: string;
  cdId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await deleteConcreteDetail(writingId, cdId);
        })
      }
      disabled={pending}
      title="Remove CD"
      className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
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
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      Add CM
    </button>
  );
}

function DeleteCmButton({
  writingId,
  cmId,
}: {
  writingId: string;
  cmId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await deleteCommentaryItem(writingId, cmId);
        })
      }
      disabled={pending}
      title="Remove CM"
      className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}
