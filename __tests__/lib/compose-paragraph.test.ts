/**
 * Unit coverage for chunk 4.5d-3 — paragraph composition from tagged
 * Shaping Sheet sentences (the Paragraph Form artifact).
 */

import { describe, it, expect } from "vitest";
import {
  composeParagraphSegments,
  composeParagraphText,
} from "@/lib/compose-paragraph";

describe("composeParagraphSegments — 2+:1", () => {
  const segments = composeParagraphSegments({
    topicSentence: "Exercise helps teens.",
    chunks: [
      {
        cd_sentences: ["The heart strengthens.", "Bone density rises."],
        cm_sentences: ["These set up a healthier adulthood."],
      },
    ],
    concludingSentence: "Movement pays off.",
  });

  it("orders segments TS → CDs → CMs → CS", () => {
    expect(segments.map((s) => s.role)).toEqual(["ts", "cd", "cd", "cm", "cs"]);
  });

  it("preserves the sentence text", () => {
    expect(segments[0]).toEqual({ role: "ts", text: "Exercise helps teens." });
    expect(segments[4]).toEqual({ role: "cs", text: "Movement pays off." });
  });
});

describe("composeParagraphSegments — edge cases", () => {
  it("skips empty/blank sentences", () => {
    const segments = composeParagraphSegments({
      topicSentence: "  ",
      chunks: [{ cd_sentences: ["A fact.", ""], cm_sentences: ["   "] }],
      concludingSentence: null,
    });
    expect(segments).toEqual([{ role: "cd", text: "A fact." }]);
  });

  it("renders no CM segments at 3+:0 (empty cm_sentences)", () => {
    const segments = composeParagraphSegments({
      topicSentence: "TS.",
      chunks: [{ cd_sentences: ["CD1.", "CD2.", "CD3."], cm_sentences: [] }],
      concludingSentence: "CS.",
    });
    expect(segments.some((s) => s.role === "cm")).toBe(false);
    expect(segments.map((s) => s.role)).toEqual(["ts", "cd", "cd", "cd", "cs"]);
  });

  it("inserts C/CA/R segments before the concluding sentence", () => {
    const segments = composeParagraphSegments({
      topicSentence: "TS.",
      chunks: [],
      concession: "Some say otherwise.",
      counterargument: "They argue X.",
      refutation: "But X fails.",
      concludingSentence: "CS.",
    });
    expect(segments.map((s) => s.role)).toEqual([
      "ts",
      "other",
      "other",
      "other",
      "cs",
    ]);
  });

  it("trims whitespace on kept sentences", () => {
    const [seg] = composeParagraphSegments({
      topicSentence: "  Padded.  ",
      chunks: [],
      concludingSentence: null,
    });
    expect(seg.text).toBe("Padded.");
  });
});

describe("composeParagraphText", () => {
  it("joins kept segments with single spaces", () => {
    const text = composeParagraphText({
      topicSentence: "One.",
      chunks: [{ cd_sentences: ["Two."], cm_sentences: ["Three."] }],
      concludingSentence: "Four.",
    });
    expect(text).toBe("One. Two. Three. Four.");
  });

  it("returns an empty string when there is nothing to compose", () => {
    const text = composeParagraphText({
      topicSentence: null,
      chunks: [],
      concludingSentence: null,
    });
    expect(text).toBe("");
  });
});
