"use client";

/**
 * One body paragraph's cm_dev pane: per-CD section showing existing
 * word-CMs as a vertical list, with [+ Add word] / [×] delete affordances.
 *
 * 5 starter word slots are pre-created by the writing-structure bootstrap
 * for every Literary CD, so the student lands on a populated form rather
 * than an empty one. They can delete any slot they don't need; clicking
 * [+ Add word] inserts another row.
 *
 * Each input is an AutoSaveInput firing updateCmText on blur.
 */

import { useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  createWordCm,
  updateCmText,
  deleteCm,
} from "@/lib/actions/commentary";
import { useWritingMode } from "../use-writing-mode";
import type {
  CommentaryBpData,
  CommentaryItemData,
} from "@/lib/queries/commentary";

export function CmDevBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: CommentaryBpData;
}) {
  if (bp.chunks.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
        Body paragraph {bp.position} has no chunks yet. Visit gather-CDs
        and select candidates first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {bp.chunks.map((chunk) => (
        <section
          key={chunk.id}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
        >
          {chunk.cds.length === 0 ? (
            <p className="text-sm text-gray-600 italic">
              No concrete details in chunk {chunk.position}. Add a CD on
              gather-CDs first.
            </p>
          ) : (
            chunk.cds.map((cd) => (
              <CdSection
                key={cd.id}
                writingId={writingId}
                chunkId={chunk.id}
                cdId={cd.id}
                cdText={cd.text}
                words={cd.words}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function CdSection({
  writingId,
  chunkId,
  cdId,
  cdText,
  words,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  cdText: string;
  words: readonly CommentaryItemData[];
}) {
  const { isReadOnly } = useWritingMode();
  return (
    <div className="space-y-3">
      <header className="border-l-4 border-red-300 pl-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Concrete Detail
        </div>
        <p className="text-sm text-gray-900 whitespace-pre-wrap mt-0.5">
          {cdText.trim() || (
            <span className="italic text-gray-400">
              (empty CD — fill it in on gather-cds)
            </span>
          )}
        </p>
      </header>

      <div className="ml-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
          Words {words.length > 0 && <span className="text-gray-500 normal-case font-normal">· {words.length} brainstormed</span>}
        </div>
        {words.length === 0 && (
          <p className="text-xs text-gray-500 italic">
            No words yet. Click [Add word] below to start brainstorming.
          </p>
        )}
        {words.map((word) => (
          <WordRow key={word.id} writingId={writingId} word={word} />
        ))}
        {!isReadOnly && (
          <AddWordButton
            writingId={writingId}
            chunkId={chunkId}
            parentCdId={cdId}
          />
        )}
      </div>
    </div>
  );
}

function WordRow({
  writingId,
  word,
}: {
  writingId: string;
  word: CommentaryItemData;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <AutoSaveInput
          initialValue={word.text}
          placeholder="One word — tone, mood, character trait…"
          disabled={isReadOnly}
          onSave={async (text) => {
            await updateCmText(writingId, word.id, text);
          }}
        />
      </div>
      {!isReadOnly && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              await deleteCm(writingId, word.id);
            })
          }
          disabled={pending}
          title="Remove word"
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
  );
}

function AddWordButton({
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
          await createWordCm(writingId, chunkId, parentCdId);
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
      Add word
    </button>
  );
}
