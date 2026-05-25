/**
 * Unit coverage for chunk 4.5d-3 — the "once you use it, you lose it"
 * Shaping Sheet repetition linter helper.
 */

import { describe, it, expect } from "vitest";
import { findRepeatedContentWords } from "@/lib/once-you-lose-it";

describe("findRepeatedContentWords", () => {
  it("flags a content word repeated across two sentences", () => {
    const result = findRepeatedContentWords([
      "Regular exercise strengthens the heart.",
      "Exercise also stabilizes mood.",
    ]);
    expect(result).toContainEqual({ word: "exercise", sentenceCount: 2 });
  });

  it("ignores stopwords like 'the' and 'and'", () => {
    const result = findRepeatedContentWords([
      "The heart and the lungs.",
      "The brain and the body.",
    ]);
    const words = result.map((r) => r.word);
    expect(words).not.toContain("the");
    expect(words).not.toContain("and");
  });

  it("ignores short tokens under the minimum length", () => {
    // "up" appears twice but is below MIN_WORD_LENGTH.
    const result = findRepeatedContentWords(["Move up now.", "Step up here."]);
    expect(result.map((r) => r.word)).not.toContain("up");
  });

  it("does not flag a word that appears only once across all sentences", () => {
    const result = findRepeatedContentWords([
      "Cardiovascular endurance improves.",
      "Bone density increases.",
    ]);
    expect(result).toHaveLength(0);
  });

  it("does not double-count repeats inside a single sentence", () => {
    // "movement" twice in ONE sentence is only one distinct-sentence hit.
    const result = findRepeatedContentWords([
      "Movement begets movement over time.",
      "Sleep deepens.",
    ]);
    expect(result.map((r) => r.word)).not.toContain("movement");
  });

  it("is case-insensitive", () => {
    const result = findRepeatedContentWords([
      "Endorphins lift mood.",
      "ENDORPHINS reduce stress.",
    ]);
    expect(result).toContainEqual({ word: "endorphins", sentenceCount: 2 });
  });

  it("treats hyphenated words as single tokens and strips punctuation", () => {
    const result = findRepeatedContentWords([
      "Body-fat percentages drop.",
      "Body-fat ratios shift.",
    ]);
    expect(result.map((r) => r.word)).toContain("body-fat");
  });

  it("skips blank/whitespace-only sentences", () => {
    const result = findRepeatedContentWords([
      "Focus sharpens daily.",
      "   ",
      "",
    ]);
    expect(result).toHaveLength(0);
  });

  it("sorts by descending sentence-count then alphabetically", () => {
    const result = findRepeatedContentWords([
      "Exercise sharpens focus.",
      "Exercise builds focus.",
      "Exercise also helps.",
    ]);
    // "exercise" in 3 sentences, "focus" in 2 → exercise first.
    expect(result[0]).toEqual({ word: "exercise", sentenceCount: 3 });
    expect(result[1]).toEqual({ word: "focus", sentenceCount: 2 });
  });
});
