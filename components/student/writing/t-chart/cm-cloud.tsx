"use client";

/**
 * Green commentary "cloud" for one CM (design base: T-Chart Worksheet.html) —
 * the commentary sentence in the oval, and up to 4 brainstormed supporting
 * words on the rays around it ("1 in the oval, 4 outside"). A small caption
 * frames the whole cloud; the four ray slots are intentionally unlabelled
 * (no per-ray pedagogical wording — decided 2026-07-02). A 3×3 grid places
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

  return (
    <div className="mx-auto w-full max-w-[340px]">
      {/* caption for the whole cloud (no per-ray labels) */}
      <p className="mb-2 text-center text-[11px] font-medium leading-tight text-emerald-700/70">
        Brainstorm words on the rays — why is this important?
      </p>

      <div className="grid grid-cols-[minmax(46px,1fr)_auto_minmax(46px,1fr)] grid-rows-[auto_auto_auto] items-center justify-items-center gap-x-2 gap-y-3">
        <RayWord value={words[0]} disabled={isReadOnly} onSave={(v) => saveWord(0, v)} />
        <span aria-hidden="true" />
        <RayWord value={words[1]} disabled={isReadOnly} onSave={(v) => saveWord(1, v)} />

        <span aria-hidden="true" />
        <Oval
          cm={cm}
          writingId={writingId}
          disabled={isReadOnly}
          onDelete={onDelete}
        />
        <span aria-hidden="true" />

        <RayWord value={words[2]} disabled={isReadOnly} onSave={(v) => saveWord(2, v)} />
        <span aria-hidden="true" />
        <RayWord value={words[3]} disabled={isReadOnly} onSave={(v) => saveWord(3, v)} />
      </div>
    </div>
  );
}

/* ─── The oval (holds the commentary sentence + delete) ───────────── */

function Oval({
  cm,
  writingId,
  disabled,
  onDelete,
}: {
  cm: CommentaryItemData;
  writingId: string;
  disabled: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="relative w-[190px] max-w-full">
      {/* four rays reaching toward the corner words */}
      <Ray className="left-[8%] top-[10%] -rotate-[38deg]" />
      <Ray className="right-[8%] top-[10%] rotate-[38deg]" />
      <Ray className="bottom-[10%] left-[8%] rotate-[38deg]" />
      <Ray className="bottom-[10%] right-[8%] -rotate-[38deg]" />

      <div
        className="flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-[50%] border-[2.5px] px-8 py-6 text-center"
        style={{ borderColor: GREEN }}
      >
        <AutoSaveInput
          bare
          multiline
          rows={2}
          initialValue={cm.text}
          placeholder="Write your commentary…"
          disabled={disabled}
          className="text-center text-sm leading-snug text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/40"
          onSave={async (text) => {
            await updateCommentaryItem(writingId, cm.id, text);
          }}
        />
        {!disabled && onDelete && (
          <DeleteButton title="Remove CM" onConfirm={onDelete} />
        )}
      </div>
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
    <div className="w-full min-w-[46px] max-w-[84px]">
      <AutoSaveInput
        bare
        initialValue={value}
        placeholder="word"
        disabled={disabled}
        className="border-b border-emerald-300 pb-0.5 text-center text-xs text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/35"
        onSave={onSave}
      />
    </div>
  );
}

function Ray({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-0 w-7 border-t-[1.5px] ${className}`}
      style={{ borderColor: GREEN, opacity: 0.7 }}
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
