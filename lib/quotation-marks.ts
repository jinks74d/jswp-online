/**
 * Quotation-mark checks for the Embedding Quotations micro-lesson
 * (CLAUDE.md §4, 2024 Expository Guide pp.77–79).
 *
 * The T-Chart used to wrap a quotation CD in quotation marks for the
 * student when composing the embedded preview. That was wrong twice over:
 * it doubled up on students who had typed their own marks, and it assumed
 * the *whole* CD is the quote — which breaks the blended quotation the
 * guide actually teaches, where quoted fragments are woven into the
 * student's own sentence:
 *
 *   This "fifty-five-year-old woman" with her "feet wrapped in rags"…
 *
 * Placing the marks is the skill being assessed, so the app no longer
 * places them. It only checks that the student did.
 *
 * No React, no server-only — unit-tested in
 * __tests__/lib/quotation-marks.test.ts.
 */

/**
 * Double-quote characters accepted as quotation marks: straight (what a
 * keyboard types), curly (what Word and Google Docs autocorrect to, and
 * what students paste), and guillemets (some pasted sources use them).
 * Apostrophes and single quotes are deliberately excluded — a single quote
 * marks a quote-within-a-quote, not the quotation itself.
 */
const DOUBLE_QUOTE_CHARS = ['"', "“", "”", "«", "»"];

function isQuoteChar(ch: string): boolean {
  return DOUBLE_QUOTE_CHARS.includes(ch);
}

/** How many quotation marks the text contains, of any accepted flavour. */
export function countQuotationMarks(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (isQuoteChar(ch)) n++;
  }
  return n;
}

/**
 * True when the text contains at least one *complete* pair of quotation
 * marks with something quoted between them.
 *
 * Deliberately lenient about position: a quotation CD may be fully quoted
 * ("the woods are lovely") or blended (This "woman" with her "crutch"),
 * and both are correct JSWP. What it will not accept is an unclosed mark —
 * one lonely " is the mistake this check exists to catch.
 */
export function hasQuotationPair(text: string): boolean {
  const first = [...text].findIndex(isQuoteChar);
  if (first === -1) return false;

  const chars = [...text];
  let last = -1;
  for (let i = chars.length - 1; i > first; i--) {
    if (isQuoteChar(chars[i]!)) {
      last = i;
      break;
    }
  }
  if (last === -1) return false;

  // Something must actually sit between the marks, so `""` and `" "` don't
  // read as a quotation.
  return chars.slice(first + 1, last).join("").trim().length > 0;
}
