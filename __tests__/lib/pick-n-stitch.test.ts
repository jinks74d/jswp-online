/**
 * "When you use it, you lose it" bookkeeping for the Expository T-Chart.
 *
 * The pool the student stitches from spans two storage shapes — the cloud's
 * oval (a commentary_items row, tracked by the used_in_* booleans) and its
 * four ray phrases (web_words entries, tracked by the index-aligned
 * web_word_uses array from migration 0045). These tests pin the flattening
 * and the single-use rule.
 */

import { describe, it, expect } from "vitest";
import {
  collectStitchPool,
  collectCmEntries,
  unusedEntries,
  ovalUse,
  rayUse,
  withRayUse,
  isStitchTarget,
} from "@/lib/pick-n-stitch";
import type { ChunkData, CommentaryItemData } from "@/lib/queries/t-charts";

function cm(overrides: Partial<CommentaryItemData> = {}): CommentaryItemData {
  return {
    id: "cm1",
    position: 1,
    text: "devoted mother",
    parent_cd_id: "cd1",
    kind: "sentence",
    web_words: ["resolute and steadfast", "unconditional love", "", ""],
    web_word_uses: null,
    used_in_topic_sentence: false,
    used_in_cm_sentence: false,
    used_in_concluding_sentence: false,
    ...overrides,
  } as CommentaryItemData;
}

function chunk(items: CommentaryItemData[]): ChunkData {
  return {
    id: "c1",
    position: 1,
    ratio: "nonlit_expository_two_plus_to_one",
    concrete_details: [],
    commentary_items: items,
  } as unknown as ChunkData;
}

describe("collectStitchPool", () => {
  it("flattens the oval and its non-empty rays, oval first", () => {
    const pool = collectStitchPool([chunk([cm()])]);

    expect(pool.map((e) => e.text)).toEqual([
      "devoted mother",
      "resolute and steadfast",
      "unconditional love",
    ]);
    expect(pool[0]!.slot).toBeNull();
    expect(pool[1]!.slot).toBe(0);
    expect(pool[2]!.slot).toBe(1);
  });

  it("skips blank ovals and blank ray slots", () => {
    const pool = collectStitchPool([
      chunk([cm({ text: "   ", web_words: ["", "kept", "  ", ""] })]),
    ]);

    expect(pool.map((e) => e.text)).toEqual(["kept"]);
    expect(pool[0]!.slot).toBe(1);
  });

  it("tolerates a missing web_words array", () => {
    const pool = collectStitchPool([chunk([cm({ web_words: null })])]);
    expect(pool.map((e) => e.text)).toEqual(["devoted mother"]);
  });

  it("carries each entry's spend through from both storage shapes", () => {
    const pool = collectStitchPool([
      chunk([
        cm({
          used_in_topic_sentence: true,
          web_word_uses: ["cs", "", "", ""],
        }),
      ]),
    ]);

    expect(pool[0]!.usedIn).toBe("ts"); // oval, from the boolean
    expect(pool[1]!.usedIn).toBe("cs"); // ray 0, from the array
    expect(pool[2]!.usedIn).toBeNull(); // ray 1, untouched
  });

  it("walks chunks in order", () => {
    const pool = collectStitchPool([
      chunk([cm({ id: "a", text: "first", web_words: null })]),
      chunk([cm({ id: "b", text: "second", web_words: null })]),
    ]);

    expect(pool.map((e) => e.text)).toEqual(["first", "second"]);
  });
});

describe("collectCmEntries", () => {
  // The Shaping Sheet's pick-n-stitch panel filters CMs by `kind` before it
  // flattens, so it hands over a flat list rather than chunks. Its pool must
  // be the whole cloud — the oval AND the rays — because the panel used to
  // show only the oval, leaving the brainstormed phrases unreachable.
  it("returns the oval and its rays for a flat CM list", () => {
    expect(collectCmEntries([cm()]).map((e) => e.text)).toEqual([
      "devoted mother",
      "resolute and steadfast",
      "unconditional love",
    ]);
  });

  it("agrees with collectStitchPool over the same commentary", () => {
    const items = [cm({ id: "a" }), cm({ id: "b", text: "second oval" })];

    expect(collectCmEntries(items)).toEqual(collectStitchPool([chunk(items)]));
  });

  it("keys each entry by cm and slot so a cloud's five entries stay distinct", () => {
    const entries = collectCmEntries([cm()]);

    expect(entries.map((e) => `${e.cmId}:${e.slot ?? "oval"}`)).toEqual([
      "cm1:oval",
      "cm1:0",
      "cm1:1",
    ]);
  });
});

describe("unusedEntries", () => {
  it("keeps only what has not been spent", () => {
    const pool = collectStitchPool([
      chunk([
        cm({
          used_in_cm_sentence: true,
          web_word_uses: ["ts", "", "", ""],
        }),
      ]),
    ]);

    expect(unusedEntries(pool).map((e) => e.text)).toEqual([
      "unconditional love",
    ]);
  });

  it("returns everything when nothing has been spent", () => {
    expect(unusedEntries(collectStitchPool([chunk([cm()])]))).toHaveLength(3);
  });
});

describe("ovalUse", () => {
  it("reads each boolean", () => {
    expect(ovalUse(cm({ used_in_topic_sentence: true }))).toBe("ts");
    expect(ovalUse(cm({ used_in_cm_sentence: true }))).toBe("cm");
    expect(ovalUse(cm({ used_in_concluding_sentence: true }))).toBe("cs");
    expect(ovalUse(cm())).toBeNull();
  });

  it("resolves legacy multi-flag rows by completion order, not column order", () => {
    // The Shaping Sheet toggles these independently, so both can be set.
    expect(
      ovalUse(cm({ used_in_cm_sentence: true, used_in_concluding_sentence: true }))
    ).toBe("cm");
  });
});

describe("rayUse", () => {
  it("reads the aligned slot", () => {
    const item = cm({ web_word_uses: ["", "cs", "", ""] });
    expect(rayUse(item, 0)).toBeNull();
    expect(rayUse(item, 1)).toBe("cs");
  });

  it("returns null for a missing array, a short array, or a junk value", () => {
    expect(rayUse(cm({ web_word_uses: null }), 0)).toBeNull();
    expect(rayUse(cm({ web_word_uses: ["ts"] }), 3)).toBeNull();
    expect(rayUse(cm({ web_word_uses: ["nonsense"] }), 0)).toBeNull();
  });
});

describe("withRayUse", () => {
  it("writes one slot and pads to four", () => {
    expect(withRayUse(null, 2, "cm")).toEqual(["", "", "cm", ""]);
  });

  it("preserves the other slots", () => {
    expect(withRayUse(["ts", "", "cs", ""], 1, "cm")).toEqual([
      "ts",
      "cm",
      "cs",
      "",
    ]);
  });

  it("clears a slot when releasing it", () => {
    expect(withRayUse(["ts", "cm", "", ""], 0, null)).toEqual([
      "",
      "cm",
      "",
      "",
    ]);
  });

  it("ignores an out-of-range slot rather than growing the array", () => {
    expect(withRayUse(null, 9, "ts")).toEqual(["", "", "", ""]);
  });
});

describe("isStitchTarget", () => {
  it("accepts the three targets and nothing else", () => {
    expect(isStitchTarget("ts")).toBe(true);
    expect(isStitchTarget("cm")).toBe(true);
    expect(isStitchTarget("cs")).toBe(true);
    expect(isStitchTarget("")).toBe(false);
    expect(isStitchTarget(null)).toBe(false);
    expect(isStitchTarget("TS")).toBe(false);
  });
});
