/**
 * Splits source text into sentence-sized pieces carrying their absolute
 * character offsets in the original source_text. Used by the Reading &
 * Annotation view to offer a keyboard-only path to CREATE an annotation:
 * each sentence becomes a focusable target that opens the create form with
 * that sentence's range pre-filled (WCAG 2.1.1 — the mouse drag-select path
 * is otherwise the only way to make an annotation).
 *
 * Offsets are relative to the whole source_text, so a piece produced from a
 * mid-document run (baseOffset > 0) still maps back to the correct
 * text_annotations.range_start/end.
 *
 * Deliberately simple: split after ., !, or ? (plus any trailing closing
 * quotes/brackets and whitespace). This over-splits on abbreviations
 * ("Dr. Louis") but never mis-maps offsets, which is the property that
 * matters — a slightly short sentence range is still a valid annotation.
 */

export interface SentencePiece {
  /** Verbatim slice of the source, including trailing whitespace. */
  readonly text: string;
  /** Absolute start offset in source_text (inclusive). */
  readonly start: number;
  /** Absolute end offset in source_text (exclusive). */
  readonly end: number;
}

const TERMINATORS = new Set([".", "!", "?"]);
const TRAILERS = /["')\]]/;

export function splitSentences(
  text: string,
  baseOffset: number
): readonly SentencePiece[] {
  const pieces: SentencePiece[] = [];
  const n = text.length;
  let segStart = 0;
  let i = 0;

  while (i < n) {
    const ch = text[i];
    if (TERMINATORS.has(ch)) {
      let j = i + 1;
      // Absorb consecutive terminators and closing quotes/brackets ("?!", '."').
      while (j < n && (TERMINATORS.has(text[j]) || TRAILERS.test(text[j]))) j++;
      // Absorb trailing whitespace so the next piece starts at real content.
      while (j < n && /\s/.test(text[j])) j++;
      pieces.push({
        text: text.slice(segStart, j),
        start: baseOffset + segStart,
        end: baseOffset + j,
      });
      segStart = j;
      i = j;
    } else {
      i++;
    }
  }

  if (segStart < n) {
    pieces.push({
      text: text.slice(segStart),
      start: baseOffset + segStart,
      end: baseOffset + n,
    });
  }

  return pieces;
}

/**
 * The annotate-able core of a piece — its offsets with surrounding
 * whitespace trimmed off, so a created annotation doesn't include the
 * leading/trailing spaces that pad the sentence in the source.
 */
export function trimmedRange(piece: SentencePiece): {
  start: number;
  end: number;
} {
  const leading = piece.text.length - piece.text.trimStart().length;
  const trailing = piece.text.length - piece.text.trimEnd().length;
  return {
    start: piece.start + leading,
    end: piece.end - trailing,
  };
}
