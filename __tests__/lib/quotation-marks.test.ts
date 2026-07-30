/**
 * Unit coverage for the Embedding Quotations mark check. The app stopped
 * adding quotation marks around a quotation CD (they doubled up, and they
 * assumed the whole CD was the quote); this helper is what tells the
 * student they still owe the marks.
 */

import { describe, it, expect } from "vitest";
import { countQuotationMarks, hasQuotationPair } from "@/lib/quotation-marks";

describe("hasQuotationPair", () => {
  it("accepts a fully quoted CD", () => {
    expect(hasQuotationPair('"the woods are lovely"')).toBe(true);
  });

  it("accepts a blended quotation with the student's own words around it", () => {
    // The guide's own example (2024 Expository Guide p.79) — quoted
    // fragments woven into the student's sentence. A "must start and end
    // with a quote" rule would wrongly reject this.
    expect(
      hasQuotationPair(
        'This "fifty-five-year-old woman" with her "feet wrapped in rags"'
      )
    ).toBe(true);
  });

  it("accepts curly quotes from Word / Google Docs", () => {
    expect(hasQuotationPair("“the woods are lovely”")).toBe(true);
  });

  it("accepts guillemets from pasted sources", () => {
    expect(hasQuotationPair("«the woods are lovely»")).toBe(true);
  });

  it("accepts a straight opening mark closed by a curly one", () => {
    // Students mix these constantly when they paste half a sentence.
    expect(hasQuotationPair('"the woods are lovely”')).toBe(true);
  });

  it("rejects text with no quotation marks at all", () => {
    expect(hasQuotationPair("the woods are lovely")).toBe(false);
  });

  it("rejects a single unclosed mark — the mistake this exists to catch", () => {
    expect(hasQuotationPair('"the woods are lovely')).toBe(false);
    expect(hasQuotationPair('the woods are lovely"')).toBe(false);
  });

  it("rejects empty or whitespace-only quotes", () => {
    expect(hasQuotationPair('""')).toBe(false);
    expect(hasQuotationPair('"   "')).toBe(false);
  });

  it("ignores apostrophes and single quotes", () => {
    expect(hasQuotationPair("the traveler's horse")).toBe(false);
    expect(hasQuotationPair("'lovely'")).toBe(false);
  });

  it("handles the empty string", () => {
    expect(hasQuotationPair("")).toBe(false);
  });
});

describe("countQuotationMarks", () => {
  it("counts every accepted flavour", () => {
    expect(countQuotationMarks('"a" “b” «c»')).toBe(6);
  });

  it("counts nothing in unquoted text", () => {
    expect(countQuotationMarks("the traveler's horse")).toBe(0);
  });
});
