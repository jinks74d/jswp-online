"use client";

/**
 * Green commentary "cloud" for one CM (design base: T-Chart Worksheet.html) —
 * the commentary sentence in the oval, and up to 4 brainstormed supporting
 * words on the rays around it ("1 in the oval, 4 outside"). A 3×3 grid places
 * the oval in the centre and the four word inputs in the corners; four green
 * rays connect them.
 *
 * Owns one CM's editing: the central sentence (updateCommentaryItem) and the
 * four ray words (updateCommentaryWebWords). The four words live in local
 * state and the whole 4-slot array is written on every save, so no stale-index
 * race (mirrors the shaping SentenceList). web_words persists via migration 0037.
 */

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import {
  updateCommentaryItem,
  updateCommentaryWebWords,
} from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { CommentaryItemData } from "@/lib/queries/t-charts";

const GREEN = "#15803d";

function toFourSlots(words: readonly string[] | null): string[] {
  return [0, 1, 2, 3].map((i) => words?.[i] ?? "");
}

export function CmCloud({
  writingId,
  cm,
  onDelete,
}: {
  writingId: string;
  cm: CommentaryItemData;
  onDelete?: () => void;
}) {
  const { isReadOnly } = useWritingMode();
  const [words, setWords] = useState<string[]>(() => toFourSlots(cm.web_words));

  const saveWord = async (index: number, value: string) => {
    const next = words.slice();
    next[index] = value;
    setWords(next);
    await updateCommentaryWebWords(writingId, cm.id, next);
  };

  const oval = (
    <div className="relative w-full">
      {/* rays at the four diagonals, pointing to the corner words */}
      <Ray className="-left-3 -top-2 -rotate-[35deg]" />
      <Ray className="-right-3 -top-2 rotate-[35deg]" />
      <Ray className="-bottom-2 -left-3 rotate-[35deg]" />
      <Ray className="-bottom-2 -right-3 -rotate-[35deg]" />

      <div
        className="flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[50%] border-2 px-[16%] py-6 text-center"
        style={{ borderColor: GREEN }}
      >
        <AutoSaveInput
          bare
          multiline
          rows={2}
          initialValue={cm.text}
          placeholder="Why is this important? What does it mean?"
          disabled={isReadOnly}
          className="text-center text-sm text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/40"
          onSave={async (text) => {
            await updateCommentaryItem(writingId, cm.id, text);
          }}
        />
        {!isReadOnly && onDelete && (
          <DeleteButton title="Remove CM" onConfirm={onDelete} />
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-[minmax(48px,auto)_1fr_minmax(48px,auto)] grid-rows-[auto_1fr_auto] items-center justify-items-center gap-x-1 gap-y-2">
      <RayWord value={words[0]} disabled={isReadOnly} onSave={(v) => saveWord(0, v)} />
      <span aria-hidden="true" />
      <RayWord value={words[1]} disabled={isReadOnly} onSave={(v) => saveWord(1, v)} />

      <span aria-hidden="true" />
      {oval}
      <span aria-hidden="true" />

      <RayWord value={words[2]} disabled={isReadOnly} onSave={(v) => saveWord(2, v)} />
      <span aria-hidden="true" />
      <RayWord value={words[3]} disabled={isReadOnly} onSave={(v) => saveWord(3, v)} />
    </div>
  );
}

/* ─── One ray word (a small green write-on-the-line input) ────────── */

function RayWord({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  return (
    <div className="w-full min-w-[52px] max-w-[80px]">
      <AutoSaveInput
        bare
        initialValue={value}
        placeholder="word"
        disabled={disabled}
        className="border-b border-emerald-300 pb-0.5 text-center text-xs text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/40"
        onSave={onSave}
      />
    </div>
  );
}

function Ray({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-0 w-5 border-t-2 ${className}`}
      style={{ borderColor: GREEN }}
    />
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
      aria-label={title}
      onClick={() =>
        start(async () => {
          await onConfirm();
        })
      }
      disabled={pending}
      className="text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
