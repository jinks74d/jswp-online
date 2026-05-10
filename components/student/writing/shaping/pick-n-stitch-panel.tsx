"use client";

/**
 * Side-panel CM list for shaping. Shows every CM (filtered to the
 * mode-relevant kind by the parent) with three toggles: "TS", "CM",
 * "CS" — corresponding to used_in_topic_sentence /
 * used_in_cm_sentence / used_in_concluding_sentence.
 *
 * Once a CM has any used_in_* flag set, it visually dims and shows a
 * "Used in: TS, CM" label so students don't reuse the same phrase
 * across sentences ("once you use it, you lose it"). Toggling a flag
 * back off un-dims.
 *
 * For Literary, CMs flagged is_best_word_for_chunk get a sky pill so
 * students can see which words/phrases were the picked-best ones from
 * the decisions step.
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  setCmFlag,
  type PickNStitchFlag,
} from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type { ShapingCmData } from "@/lib/queries/shaping";

const FLAGS: ReadonlyArray<{ key: PickNStitchFlag; short: string; long: string }> = [
  { key: "used_in_topic_sentence", short: "TS", long: "topic sentence" },
  { key: "used_in_cm_sentence", short: "CM", long: "CM sentence" },
  { key: "used_in_concluding_sentence", short: "CS", long: "concluding sentence" },
];

export function PickNStitchPanel({
  writingId,
  cms,
  emptyMessage,
}: {
  writingId: string;
  cms: readonly ShapingCmData[];
  emptyMessage?: string;
}) {
  if (cms.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        {emptyMessage ?? "No commentary to stitch from yet."}
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Pick-n-stitch
        </div>
        <p className="text-[11px] text-gray-500 leading-snug">
          Toggle TS / CM / CS to mark where you used each phrase.
          Once you use it, you lose it.
        </p>
      </header>
      <ul className="space-y-1.5">
        {cms.map((cm) => (
          <CmRow key={cm.id} writingId={writingId} cm={cm} />
        ))}
      </ul>
    </section>
  );
}

function CmRow({
  writingId,
  cm,
}: {
  writingId: string;
  cm: ShapingCmData;
}) {
  const usedFlags = FLAGS.filter((f) => cm[f.key]);
  const dimmed = usedFlags.length > 0;
  const isBestForChunk = cm.is_best_word_for_chunk;
  const isBestForTs = cm.is_best_word_for_ts;

  const usedLabel =
    usedFlags.length === 0
      ? null
      : `Used in: ${usedFlags.map((f) => f.long).join(", ")}`;

  return (
    <li
      className={`rounded-md border ${
        dimmed
          ? "border-gray-200 bg-gray-50 opacity-70"
          : "border-gray-200 bg-white"
      } px-2 py-1.5`}
      title={usedLabel ?? undefined}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 truncate">
            {cm.text.trim() || (
              <span className="italic text-gray-400">(empty)</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {isBestForTs && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                TS-best
              </span>
            )}
            {isBestForChunk && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-medium">
                Chunk-best
              </span>
            )}
            {usedLabel && (
              <span className="text-[10px] text-gray-500 italic">
                {usedLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {FLAGS.map((f) => (
            <FlagToggle
              key={f.key}
              writingId={writingId}
              cmId={cm.id}
              flag={f.key}
              short={f.short}
              long={f.long}
              active={cm[f.key]}
            />
          ))}
        </div>
      </div>
    </li>
  );
}

function FlagToggle({
  writingId,
  cmId,
  flag,
  short,
  long,
  active,
}: {
  writingId: string;
  cmId: string;
  flag: PickNStitchFlag;
  short: string;
  long: string;
  active: boolean;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setCmFlag(writingId, cmId, flag, !active);
        })
      }
      disabled={pending || isReadOnly}
      title={`Mark as used in ${long}`}
      aria-pressed={active}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-[10px] font-semibold transition-colors disabled:opacity-50 ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700"
      }`}
    >
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : short}
    </button>
  );
}
