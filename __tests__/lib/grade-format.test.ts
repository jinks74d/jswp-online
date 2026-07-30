import { describe, it, expect } from "vitest";
import { isValidGrade, formatGradeLabel, LETTER_GRADES } from "@/lib/grade-format";

describe("isValidGrade", () => {
  it("number: 0–100 and empty valid; out-of-range/NaN invalid", () => {
    expect(isValidGrade("number", "92")).toBe(true);
    expect(isValidGrade("number", "")).toBe(true);
    expect(isValidGrade("number", "101")).toBe(false);
    expect(isValidGrade("number", "-1")).toBe(false);
    expect(isValidGrade("number", "abc")).toBe(false);
  });
  it("letter: only listed letters or empty", () => {
    expect(isValidGrade("letter", "B+")).toBe(true);
    expect(isValidGrade("letter", "")).toBe(true);
    expect(isValidGrade("letter", "E")).toBe(false);
    expect(isValidGrade("letter", "b+")).toBe(false);
  });
  it("check: check|x|empty", () => {
    expect(isValidGrade("check", "check")).toBe(true);
    expect(isValidGrade("check", "x")).toBe(true);
    expect(isValidGrade("check", "")).toBe(true);
    expect(isValidGrade("check", "maybe")).toBe(false);
  });
  it("none: only empty", () => {
    expect(isValidGrade("none", "")).toBe(true);
    expect(isValidGrade("none", "A")).toBe(false);
  });
});

describe("formatGradeLabel", () => {
  it("renders check tokens as symbols, number/letter as-is, empty/none as ''", () => {
    expect(formatGradeLabel("check", "check")).toBe("✓");
    expect(formatGradeLabel("check", "x")).toBe("✗");
    expect(formatGradeLabel("number", "92")).toBe("92");
    expect(formatGradeLabel("letter", "A-")).toBe("A-");
    expect(formatGradeLabel("letter", "")).toBe("");
    expect(formatGradeLabel("none", "A")).toBe("");
  });
});

it("LETTER_GRADES has the 13 standard entries", () => {
  expect(LETTER_GRADES.length).toBe(13);
  expect(LETTER_GRADES[0]).toBe("A+");
  expect(LETTER_GRADES[LETTER_GRADES.length - 1]).toBe("F");
});
