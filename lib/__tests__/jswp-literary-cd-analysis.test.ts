import { describe, it, expect } from "vitest";
import { LITERARY_CD_ANALYSIS_QUESTIONS } from "../jswp-literary-cd-analysis";

describe("LITERARY_CD_ANALYSIS_QUESTIONS", () => {
  it("has exactly 13 questions (guide p.78-80)", () => {
    expect(LITERARY_CD_ANALYSIS_QUESTIONS).toHaveLength(13);
  });
  it("opens with the importance question and includes the thesaurus/synonym step", () => {
    expect(LITERARY_CD_ANALYSIS_QUESTIONS[0]).toMatch(/why is this cd important/i);
    expect(LITERARY_CD_ANALYSIS_QUESTIONS.some((q) => /thesaurus/i.test(q))).toBe(true);
  });
});
