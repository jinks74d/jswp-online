import { describe, it, expect } from "vitest";
import { computeGate } from "../compute-gate";
import type { CommentaryBpData } from "@/lib/queries/commentary";

const word = (id: string, best: boolean) => ({
  id, position: 1, text: "yearn", kind: "word" as const,
  parent_cd_id: "cd1", parent_cm_id: null, synonym: null,
  is_best_word_for_ts: false, is_best_word_for_chunk: best,
});
const phrase = (id: string, parentCmId: string, text: string) => ({
  id, position: 1, text, kind: "phrase" as const,
  parent_cd_id: "cd1", parent_cm_id: parentCmId, synonym: null,
  is_best_word_for_ts: false, is_best_word_for_chunk: false,
});
const bp = (cds: CommentaryBpData["chunks"][number]["cds"]): CommentaryBpData => ({
  id: "bp1", position: 1, chunks: [{ id: "c1", position: 1, cds }],
});

describe("computeGate (elaboration)", () => {
  it("blocks when a best word has fewer than 2 phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a")], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: false, blockerPosition: 1 });
  });

  it("passes when every best word has 2+ non-empty phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a"), phrase("p2", "w1", "b")], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: true, blockerPosition: null });
  });

  it("ignores phrases linked to a different word and blank phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a"), phrase("p2", "w1", "   "), phrase("p3", "w2", "b")],
      sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: false, blockerPosition: 1 });
  });

  it("passes a BP with no best words (nothing to elaborate yet)", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", false)], phrases: [], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: true, blockerPosition: null });
  });
});
