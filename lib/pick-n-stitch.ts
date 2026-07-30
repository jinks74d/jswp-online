/**
 * Pick-n-Stitch bookkeeping for the Expository T-Chart —
 * "When you use it, you lose it" (CLAUDE.md §4, glossary).
 *
 * Three of the T-Chart's six regions are written by stitching together
 * commentary the student has not spent yet: the Revised Topic Sentence (④),
 * the Commentary Sentence (⑤) and the Concluding Sentence (⑥). The material
 * they draw from is the CM clouds — each cloud contributing its oval
 * sentence plus up to four ray words/phrases.
 *
 * Two storage shapes back that pool, for historical reasons:
 *   - the oval is a commentary_items row, tracked by the three
 *     used_in_* booleans from migration 0001;
 *   - the rays are entries in commentary_items.web_words (0037), tracked
 *     by the index-aligned web_word_uses array (0045).
 *
 * This module flattens both into one `StitchEntry` shape so the UI never
 * branches on storage, and answers the question the student actually has:
 * what is left?
 *
 * No React, no server-only — unit-tested in
 * __tests__/lib/pick-n-stitch.test.ts.
 */

/**
 * The minimum a commentary row must expose to take part in pick-n-stitch.
 * Declared structurally rather than importing a query type, because two
 * screens draw from the same pool with two different row shapes:
 * `CommentaryItemData` (T-Chart) and `ShapingCmData` (Shaping Sheet).
 */
export interface StitchableCm {
  readonly id: string;
  readonly text: string;
  readonly web_words: readonly string[] | null;
  readonly web_word_uses: readonly string[] | null;
  readonly used_in_topic_sentence: boolean;
  readonly used_in_cm_sentence: boolean;
  readonly used_in_concluding_sentence: boolean;
}

/** The three sentences that consume commentary, in completion order. */
export type StitchTarget = "ts" | "cm" | "cs";

export const STITCH_TARGETS: readonly {
  readonly key: StitchTarget;
  /** Compact button label. */
  readonly short: string;
  /** Spoken/hover form, matching the T-Chart's row labels. */
  readonly long: string;
}[] = [
  { key: "ts", short: "TS", long: "Revised Topic Sentence" },
  { key: "cm", short: "CM", long: "Commentary Sentence" },
  { key: "cs", short: "CS", long: "Concluding Sentence" },
];

export function isStitchTarget(value: unknown): value is StitchTarget {
  return value === "ts" || value === "cm" || value === "cs";
}

/** One spendable piece of commentary — an oval sentence or a ray phrase. */
export interface StitchEntry {
  /** commentary_items.id. */
  readonly cmId: string;
  /** null for the oval; 0-3 for a ray slot. */
  readonly slot: number | null;
  readonly text: string;
  /** Where it was spent, or null while it is still available. */
  readonly usedIn: StitchTarget | null;
}

/**
 * Which target the oval's own text was spent on. The three booleans predate
 * the single-valued rule, so more than one can be set by older data (or by
 * the Shaping Sheet's independent toggles); completion order breaks the tie
 * so the answer is stable rather than dependent on column order.
 */
export function ovalUse(cm: StitchableCm): StitchTarget | null {
  if (cm.used_in_topic_sentence) return "ts";
  if (cm.used_in_cm_sentence) return "cm";
  if (cm.used_in_concluding_sentence) return "cs";
  return null;
}

/** The stored use for one ray slot, tolerating a short or absent array. */
export function rayUse(
  cm: StitchableCm,
  slot: number
): StitchTarget | null {
  const raw = cm.web_word_uses?.[slot];
  return isStitchTarget(raw) ? raw : null;
}

/**
 * Every piece of commentary in the paragraph, oval-then-rays per cloud, in
 * chunk order. Blank slots are skipped — an empty ray is not something the
 * student can spend.
 */
export function collectStitchPool(
  chunks: readonly { readonly commentary_items: readonly StitchableCm[] }[]
): StitchEntry[] {
  return chunks.flatMap((chunk) => collectCmEntries(chunk.commentary_items));
}

/**
 * The same flattening for a caller that already holds a flat list of CMs —
 * the Shaping Sheet's pick-n-stitch panel, which has filtered by `kind`
 * before it gets here. Oval first, then that cloud's non-empty rays.
 */
export function collectCmEntries(
  cms: readonly StitchableCm[]
): StitchEntry[] {
  const pool: StitchEntry[] = [];
  for (const cm of cms) {
    const ovalText = cm.text.trim();
    if (ovalText) {
      pool.push({
        cmId: cm.id,
        slot: null,
        text: ovalText,
        usedIn: ovalUse(cm),
      });
    }
    const words = cm.web_words ?? [];
    for (let i = 0; i < words.length; i++) {
      const text = (words[i] ?? "").trim();
      if (!text) continue;
      pool.push({ cmId: cm.id, slot: i, text, usedIn: rayUse(cm, i) });
    }
  }
  return pool;
}

/** Still-unspent commentary — what the student may stitch from next. */
export function unusedEntries(pool: readonly StitchEntry[]): StitchEntry[] {
  return pool.filter((e) => e.usedIn === null);
}

/**
 * Writes `use` into slot `slot` of a whole-array copy, padding with empty
 * strings so the result stays index-aligned with web_words. The action
 * writes the entire array on every change (mirroring updateCommentaryWebWords)
 * so there is no stale-index race.
 */
export function withRayUse(
  current: readonly string[] | null,
  slot: number,
  use: StitchTarget | null
): string[] {
  const next = [0, 1, 2, 3].map((i) => current?.[i] ?? "");
  if (slot >= 0 && slot < next.length) {
    next[slot] = use ?? "";
  }
  return next;
}
