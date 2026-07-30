"use client";

/**
 * Side-panel commentary list for shaping — the pool the student stitches
 * final sentences out of.
 *
 * The pool is the WHOLE CM cloud, not just its middle. Each cloud on the
 * T-Chart contributes its oval sentence ("in the circle") *and* each of its
 * four brainstormed ray words/phrases ("around the circle"); every one of
 * them is raw material for a sentence, so every one of them appears here.
 * The flattening lives in lib/pick-n-stitch.ts (`collectCmEntries`), shared
 * with the T-Chart's own stitch counter.
 *
 * Spending is single-valued and matches the T-Chart's StitchControl: picking
 * CM when TS is active MOVES the spend rather than adding one, and clicking
 * the active button releases it. That is "when you use it, you lose it" — a
 * phrase cannot be spent twice. A spent entry strikes through and dims, so
 * what is left for the other sentences is visible at a glance.
 *
 * For Literary, entries arrive grouped under their best-word CM so the
 * student stitches CM1 from word-1's clouds and CM2 from word-2's.
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  setCommentaryItemUse,
  setCommentaryWebWordUse,
} from "@/lib/actions/t-charts";
import {
  STITCH_TARGETS,
  type StitchEntry,
  type StitchTarget,
} from "@/lib/pick-n-stitch";
import { useWritingMode } from "../use-writing-mode";

/** A pool entry plus the literary "best word" pills, when they apply. */
export interface StitchRow extends StitchEntry {
  readonly isBestForTs?: boolean;
  readonly isBestForChunk?: boolean;
}

/** One labelled section — literary groups phrases under their best word. */
export interface StitchGroup {
  readonly key: string;
  readonly heading: string;
  /** Muted sub-label after the heading (the literary synonym). */
  readonly subheading?: string | null;
  readonly rows: readonly StitchRow[];
  readonly emptyMessage: string;
}

export function PickNStitchPanel({
  writingId,
  rows,
  groups,
  emptyMessage,
}: {
  writingId: string;
  /** Flat pool — expository / argumentation. Ignored when `groups` is set. */
  rows?: readonly StitchRow[];
  /** Literary: rows grouped under their best-word CM. */
  groups?: readonly StitchGroup[];
  emptyMessage?: string;
}) {
  const hasGroups = groups !== undefined && groups.length > 0;

  const isEmpty = hasGroups
    ? groups.every((g) => g.rows.length === 0)
    : (rows?.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        {emptyMessage ?? "No commentary to stitch from yet."}
      </div>
    );
  }

  const remaining = hasGroups
    ? groups.flatMap((g) => g.rows).filter((r) => r.usedIn === null).length
    : (rows ?? []).filter((r) => r.usedIn === null).length;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Pick-n-stitch
        </div>
        <p className="text-xs text-gray-500 leading-snug">
          Everything from your CM clouds — what you wrote in the circle and
          around it. Mark where you used each one. When you use it, you lose
          it.
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-700" role="status">
          {remaining} left to use
        </p>
      </header>

      {hasGroups ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--jswp-color-cm)] mb-0.5">
                {group.heading.trim() || (
                  <span className="italic font-normal text-gray-500">
                    (no word)
                  </span>
                )}
                {group.subheading && (
                  <span className="ml-1.5 font-normal normal-case text-gray-500">
                    / {group.subheading}
                  </span>
                )}
              </h4>
              {group.rows.length === 0 ? (
                <p className="text-xs text-gray-500 italic pl-1">
                  {group.emptyMessage}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {group.rows.map((row) => (
                    <StitchRowItem
                      key={rowKey(row)}
                      writingId={writingId}
                      row={row}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(rows ?? []).map((row) => (
            <StitchRowItem key={rowKey(row)} writingId={writingId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stable per-entry key — a cloud contributes one oval and up to four rays. */
function rowKey(row: StitchRow): string {
  return `${row.cmId}:${row.slot ?? "oval"}`;
}

function StitchRowItem({
  writingId,
  row,
}: {
  writingId: string;
  row: StitchRow;
}) {
  const spent = row.usedIn !== null;
  const target = STITCH_TARGETS.find((t) => t.key === row.usedIn);
  // The oval holds the commentary sentence; a ray holds a brainstormed word
  // or phrase from around it. Naming the source keeps the panel legible once
  // one cloud has contributed five entries.
  const source = row.slot === null ? "In the circle" : "Around the circle";

  const setUse = async (use: StitchTarget | null) => {
    if (row.slot === null) {
      await setCommentaryItemUse(writingId, row.cmId, use);
    } else {
      await setCommentaryWebWordUse(writingId, row.cmId, row.slot, use);
    }
  };

  return (
    <li
      className={`rounded-md border px-2 py-1.5 ${
        spent
          ? "border-gray-200 bg-gray-50 opacity-70"
          : "border-emerald-200 bg-white"
      }`}
      title={target ? `Used in the ${target.long}` : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm text-gray-900 ${
              spent ? "line-through opacity-60" : ""
            }`}
          >
            {row.text}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {source}
            </span>
            {row.isBestForTs && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                TS-best
              </span>
            )}
            {row.isBestForChunk && (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                Chunk-best
              </span>
            )}
            {target && (
              <span className="text-[10px] italic text-gray-500">
                Used in the {target.long}
              </span>
            )}
          </div>
        </div>
        <StitchToggles label={row.text} usedIn={row.usedIn} onChange={setUse} />
      </div>
    </li>
  );
}

/**
 * The TS / CM / CS radio-style group. Mirrors the T-Chart's StitchControl:
 * single-valued, with the active button releasing the spend.
 */
function StitchToggles({
  label,
  usedIn,
  onChange,
}: {
  label: string;
  usedIn: StitchTarget | null;
  onChange: (use: StitchTarget | null) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();

  if (isReadOnly) return null;

  return (
    <div
      role="group"
      aria-label={`Mark where you used “${label}”`}
      className="flex items-center gap-0.5 shrink-0"
    >
      {STITCH_TARGETS.map((t) => {
        const active = usedIn === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            aria-label={`Used in the ${t.long}`}
            title={`Used in the ${t.long}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await onChange(active ? null : t.key);
              })
            }
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors disabled:opacity-50 ${
              active
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-gray-300 text-gray-600 hover:border-emerald-600 hover:text-emerald-700"
            }`}
          >
            {pending && active ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              t.short
            )}
          </button>
        );
      })}
    </div>
  );
}
