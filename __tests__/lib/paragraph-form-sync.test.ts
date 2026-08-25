/**
 * Overlaying the sync's composition onto the step's read.
 *
 * Pinned because the bug it fixes is invisible in every other layer: the
 * types line up, no error is thrown, and the page is correct on the SECOND
 * visit — so a test that renders twice would pass while a student saw a
 * blank fine-tune box on arrival.
 */

import { describe, it, expect } from "vitest";
import {
  applySyncedFinalText,
  type SyncableBp,
} from "@/lib/paragraph-form-sync";

const PARAGRAPH = "Ann DeGraff was a determined and resourceful pioneer.";

function bp(id: string, finalText: string): SyncableBp & { id: string } {
  return { id, paragraph_form: { id: `pf-${id}`, final_text: finalText } };
}

describe("applySyncedFinalText", () => {
  it("shows the composed paragraph on the render that first wrote it", () => {
    // What the memoized read returned: the empty value from before the write.
    const stale = [bp("a", "")];
    const synced = new Map([["pf-a", PARAGRAPH]]);
    expect(applySyncedFinalText(stale, synced)[0].paragraph_form?.final_text)
      .toBe(PARAGRAPH);
  });

  it("leaves a row the sync skipped exactly as read", () => {
    // A hand-customized paragraph is absent from the map on purpose.
    const rows = [bp("a", "my own wording")];
    expect(applySyncedFinalText(rows, new Map())[0].paragraph_form?.final_text)
      .toBe("my own wording");
  });

  it("never blanks a stored value just because the map is empty", () => {
    const rows = [bp("a", PARAGRAPH), bp("b", "second paragraph")];
    const out = applySyncedFinalText(rows, new Map());
    expect(out.map((r) => r.paragraph_form?.final_text)).toEqual([
      PARAGRAPH,
      "second paragraph",
    ]);
  });

  it("overlays only the rows named, across a multi-paragraph essay", () => {
    const rows = [bp("a", ""), bp("b", "hand-written"), bp("c", "")];
    const synced = new Map([
      ["pf-a", PARAGRAPH],
      ["pf-c", "third paragraph"],
    ]);
    expect(applySyncedFinalText(rows, synced).map((r) => r.paragraph_form?.final_text))
      .toEqual([PARAGRAPH, "hand-written", "third paragraph"]);
  });

  it("tolerates a body paragraph with no paragraph_form row yet", () => {
    const rows: SyncableBp[] = [{ paragraph_form: null }];
    expect(applySyncedFinalText(rows, new Map([["pf-a", PARAGRAPH]]))).toEqual(
      rows
    );
  });

  it("does not copy a row whose text already matches", () => {
    const rows = [bp("a", PARAGRAPH)];
    const out = applySyncedFinalText(rows, new Map([["pf-a", PARAGRAPH]]));
    expect(out[0]).toBe(rows[0]);
  });

  it("does not mutate the rows it was given", () => {
    const rows = [bp("a", "")];
    applySyncedFinalText(rows, new Map([["pf-a", PARAGRAPH]]));
    expect(rows[0].paragraph_form?.final_text).toBe("");
  });
});
