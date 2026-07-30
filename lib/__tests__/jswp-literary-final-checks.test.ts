import { describe, it, expect } from "vitest";
import {
  LITERARY_FINAL_SELF_CHECKS,
  findFirstSecondPersonPronouns,
} from "../jswp-literary-final-checks";

describe("LITERARY_FINAL_SELF_CHECKS", () => {
  it("has the LP and third-person items", () => {
    const keys = LITERARY_FINAL_SELF_CHECKS.map((c) => c.key);
    expect(keys).toEqual(["literary_present_tense", "third_person"]);
  });
});

describe("findFirstSecondPersonPronouns", () => {
  it("flags whole-word first/second person pronouns, case-insensitive", () => {
    expect(findFirstSecondPersonPronouns("I think you can see we agree")).toEqual(
      ["I", "you", "we"]
    );
  });
  it("does not flag substrings inside other words", () => {
    expect(findFirstSecondPersonPronouns("The witty mews around us")).toEqual(["us"]);
    expect(findFirstSecondPersonPronouns("Iago mourns; yours truly")).toEqual(["yours"]);
  });
  it("returns empty for clean third-person prose", () => {
    expect(findFirstSecondPersonPronouns("The character feels trapped.")).toEqual([]);
  });
});
