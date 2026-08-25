/**
 * Carrying the auto-composed final_text from the sync pass into the render
 * that triggered it.
 *
 * The Paragraph Form step runs sync-then-read:
 *
 *   await syncParagraphForms(writingId)   // composes, writes final_text
 *   const bps = await getParagraphFormData(writingId)
 *
 * which looks airtight and is not. syncParagraphForms calls
 * getParagraphFormData itself to build the composition, so the step's read is
 * the SECOND identical PostgREST GET in one render pass — and Next.js memoizes
 * those. The second call is served the response captured before the write, so
 * the render that first fills final_text hands the editor the empty string it
 * read a moment earlier. The student opens "Fine-tune wording" and finds a
 * blank box; reload and the paragraph is there. Nothing logs, nothing throws.
 *
 * Rather than defeat the memoization (a cache-busting read is a fix that works
 * until someone tidies it away, and it costs a round-trip), the sync returns
 * what it composed and the step overlays it. The value the student sees then
 * comes from the same computation that was persisted, not from a re-read that
 * may or may not observe it.
 *
 * Pure — no DB, no React, no server-only — and separate from
 * lib/actions/paragraph-form because that module is "use server", where every
 * export must be an async function.
 */

/** The minimum a row must expose to receive a synced final_text. */
export interface SyncableBp {
  readonly paragraph_form: { readonly id: string; readonly final_text: string } | null;
}

/**
 * Replace each row's final_text with the value the sync just composed for it.
 *
 * Rows the sync skipped are left exactly as read: a hand-customized paragraph
 * (final_text_customized) is absent from the map on purpose, and so is every
 * row in a mode the sync does not compose for. Absence means "the stored value
 * is already right", never "blank it".
 */
export function applySyncedFinalText<T extends SyncableBp>(
  bps: readonly T[],
  synced: ReadonlyMap<string, string>
): T[] {
  return bps.map((bp) => {
    const pf = bp.paragraph_form;
    if (!pf) return bp;
    const fresh = synced.get(pf.id);
    if (fresh === undefined || fresh === pf.final_text) return bp;
    return { ...bp, paragraph_form: { ...pf, final_text: fresh } };
  });
}
