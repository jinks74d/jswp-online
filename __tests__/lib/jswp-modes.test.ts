/**
 * Unit coverage for chunk 4.5d-1 — Expository ratio-branching + the
 * 3+:0 (summary) Shaping-gate correctness fix.
 *
 *  - getSteps() is ratio-aware: 3+:0 expository drops the discrete
 *    Gathering & Prioritizing CDs step; 2+:1 keeps it.
 *  - computeGate() skips the CM-sentence requirement for 3+:0 chunks
 *    but keeps the CD-sentence requirement, and is unchanged for 2+:1.
 */

import { describe, it, expect } from "vitest";
import {
  getSteps,
  type StepResolutionContext,
  type ChunkRatio,
} from "@/lib/jswp-modes";
import { computeGate } from "@/lib/shaping-gate";
import type { ShapingBpData, ShapingChunkData } from "@/lib/queries/shaping";

/* ─── getSteps ratio-branching ───────────────────────────────────── */

function expoCtx(chunkRatio: ChunkRatio): StepResolutionContext {
  // Non-essay, with source text — isolates the ratio variable.
  return {
    isEssay: false,
    hasCounterargument: false,
    hasSourceText: true,
    chunkRatio,
  };
}

describe("getSteps — Expository ratio-branching", () => {
  it("drops gather_cds for a 3+:0 expository writing (5-step sequence)", () => {
    const steps = getSteps("expository", expoCtx("three_plus_to_zero"));
    const keys = steps.map((s) => s.key);

    expect(keys).toEqual([
      "expository.decode_prompt",
      "expository.annotate_text",
      "expository.t_chart",
      "expository.shaping_sheet",
      "expository.paragraph_form",
    ]);
    expect(keys).not.toContain("expository.gather_cds");
  });

  it("keeps gather_cds for a 2+:1 expository writing (6-step sequence)", () => {
    const steps = getSteps("expository", expoCtx("two_plus_to_one"));
    const keys = steps.map((s) => s.key);

    expect(keys).toEqual([
      "expository.decode_prompt",
      "expository.annotate_text",
      "expository.gather_cds",
      "expository.t_chart",
      "expository.shaping_sheet",
      "expository.paragraph_form",
    ]);
  });
});

/* ─── computeGate ratio-awareness ────────────────────────────────── */

function chunk(ratio: ChunkRatio, cdSentences: string[], cmSentences: string[]): ShapingChunkData {
  return {
    id: `chunk-${ratio}`,
    position: 1,
    ratio,
    output: {
      id: "out-1",
      chunk_id: `chunk-${ratio}`,
      cd_sentences: cdSentences,
      cm_sentences: cmSentences,
    },
    cds: [],
    cms: [],
  };
}

function bp(chunks: ShapingChunkData[]): ShapingBpData {
  return {
    id: "bp-1",
    position: 1,
    shaping_sheet: {
      id: "ss-1",
      final_topic_sentence: "A polished topic sentence.",
      final_concluding_sentence: null,
      final_concession: null,
      final_counterargument: null,
      final_refutation: null,
      notes: null,
      revision_moves: null,
      narrative_shaping_cd1: null,
      narrative_shaping_cd2: null,
      narrative_shaping_cm: null,
    },
    working_topic_sentence: null,
    concluding_sentence: null,
    narrative_kind: null,
    narrative_subject: null,
    narrative_key_word: null,
    narrative_concrete_example: null,
    narrative_when: null,
    narrative_where: null,
    narrative_who: null,
    narrative_what_happened: null,
    narrative_dialogue: null,
    narrative_feeling: null,
    narrative_thinking: null,
    chunks,
  };
}

describe("computeGate — Shaping-sheet ratio-awareness", () => {
  it("passes a 3+:0 chunk with CD sentences and zero CM sentences (the bug fix)", () => {
    const gate = computeGate("expository", [
      bp([chunk("three_plus_to_zero", ["A concrete detail sentence."], [])]),
    ]);
    expect(gate.canContinue).toBe(true);
  });

  it("still fails a 2+:1 chunk with zero CM sentences (regression check)", () => {
    const gate = computeGate("expository", [
      bp([chunk("two_plus_to_one", ["A concrete detail sentence."], [])]),
    ]);
    expect(gate.canContinue).toBe(false);
    expect(gate.reason).toContain("CM sentence");
  });

  it("still fails a 3+:0 chunk with zero CD sentences (CD requirement kept)", () => {
    const gate = computeGate("expository", [
      bp([chunk("three_plus_to_zero", [], [])]),
    ]);
    expect(gate.canContinue).toBe(false);
    expect(gate.reason).toContain("CD sentence");
  });
});
