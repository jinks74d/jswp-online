/**
 * Where an annotation actually sits in the substrate it is being drawn over.
 *
 * `text_annotations` anchors work by character offset into a source's
 * `source_text`. That model has TWO consistency requirements, and the PDF
 * viewer historically enforced only the first:
 *
 *   1. the live extraction must equal the stored `source_text`
 *      (pdf-source-viewer.tsx checks this and bails to the flat viewer), and
 *   2. the stored OFFSETS must have been computed against the *same version* of
 *      that `source_text`.
 *
 * (2) broke on 2026-07-23, when `d165dd2` began stripping margin furniture
 * (page numbers, running heads) out of the PDF annotation substrate. Every
 * annotation saved before that date kept offsets into the longer, pre-strip
 * text, so highlights landed ~150 characters downstream of the words the
 * student had actually selected — silently, because requirement (1) still held.
 *
 * The recovery is that `selected_text` stores the exact snippet, so the true
 * position is searchable rather than lost. This module is that search, kept
 * pure so the viewer, the flat renderer and the one-off repair script all agree
 * on what "the right place" means.
 *
 * Tested in __tests__/lib/annotation-range.test.ts.
 */

export interface StoredAnnotationRange {
  readonly range_start: number;
  readonly range_end: number;
  readonly selected_text: string;
}

export interface ResolvedAnnotationRange {
  readonly start: number;
  readonly end: number;
  /** True when the stored offsets were stale and the snippet was re-located. */
  readonly relocated: boolean;
}

/**
 * Resolve an annotation against `text`.
 *
 * Returns the stored range untouched when it still spans exactly
 * `selected_text` — the overwhelmingly common case, and a cheap slice compare.
 * Otherwise re-locates by searching for the snippet, preferring the occurrence
 * nearest the stored offset: drift from a substrate change is directional and
 * small relative to the document, so "nearest to where it used to be" is a far
 * better guess than "first match" when a phrase such as "sewing machine"
 * appears more than once.
 *
 * Returns `null` when the annotation cannot be placed at all (empty snippet, or
 * the words no longer occur in the source — e.g. the teacher replaced the
 * file). Callers decide what to do with that; the viewer keeps drawing at the
 * stored offsets rather than making a student's work disappear.
 */
export function resolveAnnotationRange(
  text: string,
  stored: StoredAnnotationRange
): ResolvedAnnotationRange | null {
  const snippet = stored.selected_text;
  if (!snippet) return null;

  if (text.slice(stored.range_start, stored.range_end) === snippet) {
    return {
      start: stored.range_start,
      end: stored.range_end,
      relocated: false,
    };
  }

  const exact = nearestOccurrence(text, snippet, stored.range_start);
  if (exact !== -1) {
    return { start: exact, end: exact + snippet.length, relocated: true };
  }

  // Whitespace-tolerant fallback. The same extraction change that shifted
  // offsets also re-flowed line breaks, so a snippet the student selected
  // across a wrapped line ("her feet / wrapped in rags…") is stored with a
  // space where the substrate now has a newline. Compare with runs of
  // whitespace collapsed, then map the hit back to real offsets.
  const haystack = normalizeWhitespace(text);
  const needle = normalizeWhitespace(snippet).norm.trim();
  if (!needle) return null;

  // Translate the stored offset into normalized space so "nearest" still means
  // nearest in the document, not in a differently-indexed string.
  const storedInNorm = haystack.map.findIndex((o) => o >= stored.range_start);
  const hit = nearestOccurrence(
    haystack.norm,
    needle,
    storedInNorm === -1 ? haystack.norm.length : storedInNorm
  );
  if (hit === -1) return null;

  const start = haystack.map[hit];
  const end = haystack.map[hit + needle.length - 1] + 1;
  if (start === undefined || end === undefined) return null;

  return { start, end, relocated: true };
}

/** Index of the occurrence of `needle` closest to `near`, or -1 if absent. */
function nearestOccurrence(hay: string, needle: string, near: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    const distance = Math.abs(at - near);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = at;
    }
  }
  return best;
}

/**
 * Collapse whitespace runs to a single space, keeping `map[i]` = the index in
 * the original string of normalized character `i`, so a match can be mapped
 * back to real offsets.
 */
function normalizeWhitespace(s: string): { norm: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let inWhitespace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      if (inWhitespace) continue;
      inWhitespace = true;
      chars.push(" ");
    } else {
      inWhitespace = false;
      chars.push(ch);
    }
    map.push(i);
  }
  return { norm: chars.join(""), map };
}
