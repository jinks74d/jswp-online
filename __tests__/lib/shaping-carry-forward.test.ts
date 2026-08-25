/**
 * The rule that decides what a Shaping Sheet opens holding.
 *
 * Worth pinning because the failure it prevents is silent: a chunk whose
 * cm_sentences stays empty reaches the Paragraph Form as a concrete detail
 * with no commentary attached, and nothing downstream says so.
 */

import { describe, it, expect } from "vitest";
import {
  carryForwardCmSentence,
  needsCmSeed,
  type SeedableChunk,
} from "@/lib/shaping-carry-forward";

const SENTENCE =
  "She had forethought as she prepared for the long journey, and brought with her an important skill set.";

const chunk = (id: string, position: number): SeedableChunk => ({ id, position });

describe("carryForwardCmSentence", () => {
  it("seeds the paragraph's commentary sentence into its first chunk", () => {
    const seed = carryForwardCmSentence([chunk("c1", 1)], SENTENCE);
    expect(seed.get("c1")).toEqual([SENTENCE]);
  });

  it("seeds the FIRST chunk by position, not by arrival order", () => {
    const seed = carryForwardCmSentence(
      [chunk("later", 2), chunk("first", 1)],
      SENTENCE
    );
    expect(seed.get("first")).toEqual([SENTENCE]);
    expect(seed.get("later")).toEqual([]);
  });

  it("does not repeat the sentence through every chunk", () => {
    const seed = carryForwardCmSentence(
      [chunk("a", 1), chunk("b", 2), chunk("c", 3)],
      SENTENCE
    );
    const seeded = [...seed.values()].filter((v) => v.length > 0);
    expect(seeded).toHaveLength(1);
  });

  it("trims, and treats a blank T-Chart sentence as nothing to carry", () => {
    expect(carryForwardCmSentence([chunk("c1", 1)], `  ${SENTENCE}  `).get("c1"))
      .toEqual([SENTENCE]);
    expect(carryForwardCmSentence([chunk("c1", 1)], "   ").get("c1")).toEqual([]);
    expect(carryForwardCmSentence([chunk("c1", 1)], null).get("c1")).toEqual([]);
  });

  it("covers every chunk, so no chunk is left without an answer", () => {
    const seed = carryForwardCmSentence([chunk("a", 1), chunk("b", 2)], SENTENCE);
    expect([...seed.keys()].sort()).toEqual(["a", "b"]);
  });

  it("does not mutate the caller's array while sorting", () => {
    const chunks = [chunk("b", 2), chunk("a", 1)];
    carryForwardCmSentence(chunks, SENTENCE);
    expect(chunks.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("handles a paragraph with no chunks", () => {
    expect(carryForwardCmSentence([], SENTENCE).size).toBe(0);
  });
});

describe("needsCmSeed", () => {
  it("seeds an empty array", () => {
    expect(needsCmSeed([])).toBe(true);
  });

  it("seeds a null column", () => {
    expect(needsCmSeed(null)).toBe(true);
  });

  it("seeds boxes the student cleared but did not delete", () => {
    expect(needsCmSeed(["", "   "])).toBe(true);
  });

  it("leaves real work alone", () => {
    expect(needsCmSeed(["", "she never stopped looking"])).toBe(false);
  });
});
