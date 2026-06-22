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

/**
 * One group in the literary pick-n-stitch panel: a best-word CM and all
 * phrase CMs that elaborated it.
 */
export interface LiteraryCmGroup {
  word: ShapingCmData;
  phrases: readonly ShapingCmData[];
}

const FLAGS: ReadonlyArray<{ key: PickNStitchFlag; short: string; long: string }> = [
  { key: "used_in_topic_sentence", short: "TS", long: "topic sentence" },
  { key: "used_in_cm_sentence", short: "CM", long: "CM sentence" },
  { key: "used_in_concluding_sentence", short: "CS", long: "concluding sentence" },
];

export function PickNStitchPanel({
  writingId,
  cms,
  groups,
  emptyMessage,
}: {
  writingId: string;
  cms: readonly ShapingCmData[];
  /**
   * Literary-only: when provided, render phrase CMs grouped under their best
   * CM word instead of as a flat list. Each group's `word` is the best-word
   * CM; its `phrases` are the elaboration-phase phrase CMs that link to it.
   * Non-literary callers omit this prop and get the existing flat-list path.
   */
  groups?: readonly LiteraryCmGroup[];
  emptyMessage?: string;
}) {
  // Use grouped rendering for literary when groups are provided.
  const hasGroups = groups !== undefined && groups.length > 0;

  // Empty-state: for grouped mode count total phrases; for flat mode count cms.
  const isEmpty = hasGroups
    ? groups.every((g) => g.phrases.length === 0)
    : cms.length === 0;

  if (isEmpty) {
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
        <p className="text-base text-gray-500 leading-snug">
          Toggle TS / CM / CS to mark where you used each phrase.
          Once you use it, you lose it.
        </p>
      </header>

      {hasGroups ? (
        // Literary: phrases grouped under their best-word CM label.
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.word.id}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--jswp-color-cm,#16a34a)] mb-0.5">
                {group.word.text.trim() || (
                  <span className="italic font-normal text-gray-400">(no word)</span>
                )}
                {group.word.synonym && (
                  <span className="ml-1.5 font-normal normal-case text-gray-500">
                    / {group.word.synonym}
                  </span>
                )}
              </h4>
              {group.phrases.length === 0 ? (
                <p className="text-xs text-gray-400 italic pl-1">
                  No elaboration phrases for this word yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {group.phrases.map((phrase) => (
                    <CmRow key={phrase.id} writingId={writingId} cm={phrase} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Flat list — expository / argumentation, unchanged.
        <ul className="space-y-1.5">
          {cms.map((cm) => (
            <CmRow key={cm.id} writingId={writingId} cm={cm} />
          ))}
        </ul>
      )}
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
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-base font-medium">
                TS-best
              </span>
            )}
            {isBestForChunk && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-base font-medium">
                Chunk-best
              </span>
            )}
            {usedLabel && (
              <span className="text-base text-gray-500 italic">
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
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-base font-semibold transition-colors disabled:opacity-50 ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700"
      }`}
    >
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : short}
    </button>
  );
}
