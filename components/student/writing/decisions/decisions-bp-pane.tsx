"use client";

/**
 * One body paragraph's making-decisions pane. Per CD:
 *   - CD text (read-only red header)
 *   - List of word-CMs from cm_dev (read-only text — students go
 *     back to cm_dev to edit). Each row has two toggles:
 *       * Best for TS — amber Star, strict (one per BP)
 *       * Best for chunk — sky filled circle, soft (any count)
 *   - Empty state if zero words: back-link to Generating Commentary
 */

import Link from "next/link";
import { useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { setBestForTs, setBestForChunk } from "@/lib/actions/commentary";
import { useWritingMode } from "../use-writing-mode";
import type {
  CommentaryBpData,
  CommentaryItemData,
} from "@/lib/queries/commentary";

export function DecisionsBpPane({
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
              No concrete details in chunk {chunk.position}.
            </p>
          ) : (
            chunk.cds.map((cd) => (
              <CdSection
                key={cd.id}
                writingId={writingId}
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
  cdText,
  words,
}: {
  writingId: string;
  cdText: string;
  words: readonly CommentaryItemData[];
}) {
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

      <div className="ml-4">
        {words.length === 0 ? (
          <EmptyWordsState writingId={writingId} />
        ) : (
          <ul className="space-y-1.5">
            {words.map((word) => (
              <WordRow
                key={word.id}
                writingId={writingId}
                word={word}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyWordsState({ writingId }: { writingId: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
      <p className="text-amber-900">
        No words yet for this concrete detail.
      </p>
      <Link
        href={`/student/writings/${writingId}/generate-commentary`}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-50"
      >
        ← Back to Generating Commentary
      </Link>
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
  const isEmpty = word.text.trim().length === 0;
  const tintClass = word.is_best_word_for_ts
    ? "bg-amber-50"
    : word.is_best_word_for_chunk
      ? "bg-sky-50"
      : "bg-white";

  return (
    <li
      className={`flex items-center gap-3 rounded-md border border-gray-200 p-2 ${tintClass}`}
    >
      <span
        className={`flex-1 text-sm ${isEmpty ? "italic text-gray-400" : "text-gray-900"}`}
      >
        {isEmpty ? "(empty word slot)" : word.text}
      </span>

      <BestForTsToggle writingId={writingId} word={word} disabled={isEmpty} />
      <BestForChunkToggle
        writingId={writingId}
        word={word}
        disabled={isEmpty}
      />
    </li>
  );
}

function BestForTsToggle({
  writingId,
  word,
  disabled,
}: {
  writingId: string;
  word: CommentaryItemData;
  disabled: boolean;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const active = word.is_best_word_for_ts;
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setBestForTs(writingId, word.id, !active);
        })
      }
      disabled={disabled || pending || isReadOnly}
      title={active ? "Remove TS pick" : "Pick as best word for TS"}
      aria-pressed={active}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      style={
        active
          ? {
              borderColor: "rgb(245 158 11)", // amber-500
              color: "rgb(180 83 9)", // amber-700
              backgroundColor: "rgb(254 243 199)", // amber-100
            }
          : { borderColor: "rgb(209 213 219)", color: "rgb(75 85 99)" }
      }
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Star
          className="w-3.5 h-3.5"
          fill={active ? "rgb(245 158 11)" : "none"}
        />
      )}
      Best for TS
    </button>
  );
}

function BestForChunkToggle({
  writingId,
  word,
  disabled,
}: {
  writingId: string;
  word: CommentaryItemData;
  disabled: boolean;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const active = word.is_best_word_for_chunk;
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setBestForChunk(writingId, word.id, !active);
        })
      }
      disabled={disabled || pending || isReadOnly}
      title={active ? "Remove chunk pick" : "Pick as best word for chunk"}
      aria-pressed={active}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      style={
        active
          ? {
              borderColor: "rgb(14 165 233)", // sky-500
              color: "rgb(3 105 161)", // sky-700
              backgroundColor: "rgb(224 242 254)", // sky-100
            }
          : { borderColor: "rgb(209 213 219)", color: "rgb(75 85 99)" }
      }
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <span
          className="inline-block w-3 h-3 rounded-full border"
          style={
            active
              ? {
                  backgroundColor: "rgb(14 165 233)",
                  borderColor: "rgb(14 165 233)",
                }
              : { borderColor: "rgb(156 163 175)" }
          }
          aria-hidden="true"
        />
      )}
      Best for chunk
    </button>
  );
}
