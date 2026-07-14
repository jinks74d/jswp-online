import { describe, it, expect } from "vitest";
import { splitSentences, trimmedRange } from "../sentence-split";

describe("splitSentences", () => {
  it("splits on sentence terminators and preserves offsets", () => {
    const text = "The dog ran. It leapt the fence! Did it?";
    const pieces = splitSentences(text, 0);
    expect(pieces.map((p) => p.text)).toEqual([
      "The dog ran. ",
      "It leapt the fence! ",
      "Did it?",
    ]);
    // Concatenation is lossless.
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    // Offsets line up with the slices.
    for (const p of pieces) {
      expect(text.slice(p.start, p.end)).toBe(p.text);
    }
  });

  it("applies a base offset for mid-document runs", () => {
    const full = "Intro paragraph. Second sentence here.";
    const runStart = "Intro paragraph. ".length;
    const run = full.slice(runStart);
    const pieces = splitSentences(run, runStart);
    expect(pieces[0].start).toBe(runStart);
    expect(full.slice(pieces[0].start, pieces[0].end)).toBe(pieces[0].text);
  });

  it("absorbs trailing quotes and combined terminators", () => {
    const text = 'He said "stop!" Then silence...';
    const pieces = splitSentences(text, 0);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].text).toBe('He said "stop!" ');
  });

  it("handles text with no terminator as a single piece", () => {
    const pieces = splitSentences("no ending here", 5);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].start).toBe(5);
    expect(pieces[0].end).toBe(5 + "no ending here".length);
  });

  it("returns nothing for empty text", () => {
    expect(splitSentences("", 0)).toEqual([]);
  });

  it("trimmedRange strips surrounding whitespace", () => {
    const piece = { text: "  hello.  ", start: 10, end: 20 };
    const { start, end } = trimmedRange(piece);
    expect(start).toBe(12); // past the two leading spaces
    expect(end).toBe(18); // before the two trailing spaces
  });
});
