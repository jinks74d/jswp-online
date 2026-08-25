/**
 * Carrying the T-Chart's commentary sentence forward into the Shaping Sheet.
 *
 * The Shaping Sheet is a REVISION artifact — the guides call it "moved and
 * improved" — so it should open holding the sentence the T-Chart produced,
 * not a blank box. It did open blank: bootstrapShapingSheets seeded both
 * sentence arrays as [], and nothing ever filled cm_sentences unless the
 * student retyped their commentary from scratch.
 *
 * That was worse than an empty box. The Paragraph Form builds the final
 * paragraph from shaping_chunk_outputs.cm_sentences (lib/queries/
 * paragraph-form.ts), so a chunk the student never retyped reached the final
 * draft as a concrete detail with NO commentary — the one thing a 2+:1
 * paragraph cannot be missing. The Continue gate was the only thing catching
 * it, and it caught it as a dead-looking button rather than as an explanation.
 *
 * ── What carries, and what does not ──────────────────────────────────────
 * The commentary SENTENCE (t_charts.commentary_sentence, region ⑤) carries.
 * The CM clouds do not: their ovals and rays are brainstorm material —
 * "determined", "forethought", "risked her life" — and ⑤ is what the student
 * already pick-n-stitched them into. Seeding the words instead would hand the
 * Shaping Sheet the ingredients when the T-Chart step ended by producing the
 * dish, and would spend rays the student has not chosen to spend.
 *
 * Pure — no DB, no React, no server-only — so the seeding rule is unit-tested
 * rather than inferred from the action that calls it.
 */

/** The minimum a chunk must expose to be positioned within its paragraph. */
export interface SeedableChunk {
  readonly id: string;
  readonly position: number;
}

/**
 * Which chunk's CM box the paragraph's commentary sentence lands in, as
 * chunkId → sentences.
 *
 * The T-Chart carries ONE commentary sentence per body paragraph (region ⑤ is
 * a full-width row, not a per-chunk field) while the Shaping Sheet keeps CM
 * sentences per chunk. So it seeds the FIRST chunk and leaves the rest empty:
 * copying it into every chunk would repeat the same sentence through the
 * finished paragraph, once per chunk.
 */
export function carryForwardCmSentence(
  chunks: readonly SeedableChunk[],
  commentarySentence: string | null | undefined
): Map<string, string[]> {
  const seed = new Map<string, string[]>();
  const sentence = commentarySentence?.trim() ?? "";
  const ordered = chunks.slice().sort((a, b) => a.position - b.position);

  ordered.forEach((chunk, i) => {
    seed.set(chunk.id, i === 0 && sentence ? [sentence] : []);
  });
  return seed;
}

/**
 * Does this chunk output still need seeding?
 *
 * Empty means empty of CONTENT — an array of blank strings is what a student
 * leaves behind by clearing the boxes rather than deleting them, and it gates
 * exactly like []. Seeding whenever it is empty (not only at insert) is what
 * carries the rule to writings whose rows were created before this existed.
 *
 * The student who clears the box gets the sentence back on the next visit.
 * That is the intended reading of "carried forward if no additional sentence
 * is added" — and no chunk can finish with zero commentary anyway, since the
 * Continue gate requires one.
 */
export function needsCmSeed(cmSentences: readonly string[] | null): boolean {
  return !cmSentences?.some((s) => s.trim().length > 0);
}
