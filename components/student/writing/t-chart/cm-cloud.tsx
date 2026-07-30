"use client";

/**
 * Green commentary "cloud" for one CM (design base: T-Chart Worksheet.html) —
 * the commentary sentence in the oval, and four brainstormed "lofty thoughts"
 * on the rays around it ("1 in the oval, 4 outside"). A small caption frames
 * the whole cloud; the four ray slots are intentionally unlabelled (no
 * per-ray pedagogical wording — decided 2026-07-02).
 *
 * Layout (revised 2026-07-26, Raymond): the rays hold *phrases* of three or
 * more words, not single words, so the old 3×3 grid — which squeezed each ray
 * into ~70px beside a 190px oval — could not fit what students are asked to
 * write. The cloud is now a 2-column grid, two ray boxes above the oval and
 * two below, each roughly half the column wide and free to stack onto extra
 * lines as the phrase grows:
 *
 *      [ phrase ]  [ phrase ]
 *            ╲        ╱
 *         (  commentary  )
 *            ╱        ╲
 *      [ phrase ]  [ phrase ]
 *
 * The ray boxes carry a green wash rather than sitting on white, so the CM
 * side of the T reads as a block of green the way the printed sheet does.
 *
 * Owns one CM's editing: the central sentence (updateCommentaryItem) and the
 * four ray phrases (updateCommentaryWebWords). The four entries live in local
 * state and the whole 4-slot array is written on every save, so no stale-index
 * race (mirrors the shaping SentenceList). web_words persists via migration 0037.
 */

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import { StitchControl } from "./stitch-control";
import {
  updateCommentaryItem,
  updateCommentaryWebWords,
  setCommentaryWebWordUse,
  setCommentaryItemUse,
} from "@/lib/actions/t-charts";
import { ovalUse, rayUse } from "@/lib/pick-n-stitch";
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
    <div className="mx-auto w-full">
      {/* caption for the whole cloud (no per-ray labels) */}
      <p className="mb-2 text-center text-[11px] font-medium leading-snug text-emerald-700">
        Brainstorm lofty thoughts with one or two single words and the remaining
        in phrases (3 or more words). Do not write sentences.
      </p>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <RayPhrase index={0} value={words[0]!} cm={cm} writingId={writingId} onSave={saveWord} />
        <RayPhrase index={1} value={words[1]!} cm={cm} writingId={writingId} onSave={saveWord} />

        <div className="col-span-2">
          <Oval
            cm={cm}
            writingId={writingId}
            disabled={isReadOnly}
            onDelete={onDelete}
          />
        </div>

        <RayPhrase index={2} value={words[2]!} cm={cm} writingId={writingId} onSave={saveWord} />
        <RayPhrase index={3} value={words[3]!} cm={cm} writingId={writingId} onSave={saveWord} />
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
  const usedIn = ovalUse(cm);
  const spent = usedIn !== null;

  return (
    <div className="relative mx-auto w-full">
      {/* four rays reaching toward the phrase boxes above and below */}
      <Ray className="left-[12%] top-[6%] -rotate-[42deg]" />
      <Ray className="right-[12%] top-[6%] rotate-[42deg]" />
      <Ray className="bottom-[6%] left-[12%] rotate-[42deg]" />
      <Ray className="bottom-[6%] right-[12%] -rotate-[42deg]" />

      <div
        className={`flex min-h-[112px] flex-col items-center justify-center gap-0.5 rounded-[50%] border-[2.5px] px-9 py-5 text-center ${
          spent ? "bg-emerald-50/20" : "bg-emerald-50/40"
        }`}
        style={{ borderColor: GREEN, opacity: spent ? 0.75 : 1 }}
      >
        <AutoSaveInput
          bare
          multiline
          rows={2}
          initialValue={cm.text}
          placeholder="Write your commentary…"
          ariaLabel="Commentary sentence"
          disabled={disabled}
          className={`text-center text-sm leading-snug text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/40 ${
            spent ? "line-through opacity-60" : ""
          }`}
          onSave={async (text) => {
            await updateCommentaryItem(writingId, cm.id, text);
          }}
        />
        {cm.text.trim() && (
          <StitchControl
            label={cm.text.trim()}
            usedIn={usedIn}
            onChange={(use) => setCommentaryItemUse(writingId, cm.id, use)}
          />
        )}
        {!disabled && onDelete && (
          <DeleteButton title="Remove CM" onConfirm={onDelete} />
        )}
      </div>
    </div>
  );
}

/* ─── One ray slot — a green box roomy enough for a 3-4 word phrase ─
   Once spent on a sentence the text is struck through and faded, so the
   remaining rays are the ones still available to stitch from. */

function RayPhrase({
  index,
  value,
  cm,
  writingId,
  onSave,
}: {
  /** 0-3, the web_words slot. */
  index: number;
  value: string;
  cm: CommentaryItemData;
  writingId: string;
  onSave: (index: number, value: string) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const usedIn = rayUse(cm, index);
  const spent = usedIn !== null;
  const hasText = value.trim().length > 0;

  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        spent
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-emerald-300 bg-emerald-50/70"
      }`}
    >
      <AutoSaveInput
        bare
        multiline
        rows={2}
        initialValue={value}
        placeholder="word or phrase"
        ariaLabel={`Commentary word or phrase ${index + 1} of 4`}
        disabled={isReadOnly}
        className={`text-center text-[13px] leading-snug text-[color:var(--jswp-color-cm)] placeholder:text-emerald-600/40 ${
          spent ? "line-through opacity-50" : ""
        }`}
        onSave={(v) => onSave(index, v)}
      />
      {hasText && (
        <StitchControl
          label={value.trim()}
          usedIn={usedIn}
          onChange={(use) =>
            setCommentaryWebWordUse(writingId, cm.id, index, use)
          }
        />
      )}
    </div>
  );
}

function Ray({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-0 w-6 border-t-[1.5px] ${className}`}
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
      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
