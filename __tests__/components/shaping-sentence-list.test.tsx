/**
 * Regression test for the Shaping Sheet CD/CM data-loss race.
 *
 * Bug: each slot's autosave rebuilt the whole array from the `sentences`
 * PROP, which only refreshes after a server revalidate round-trip. Editing a
 * second slot before that round-trip landed made the save start from a stale
 * snapshot, so the last save won and reverted earlier slots to "" — the
 * Paragraph Form then showed only the last CD.
 *
 * This simulates the race by editing two slots WITHOUT re-rendering the parent
 * with an updated prop in between (exactly what revalidate lag looks like).
 * The second save must be cumulative, not a stale-snapshot overwrite.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SentenceList } from "@/components/student/writing/shaping/sentence-list";
import { WritingModeProvider } from "@/components/student/writing/writing-mode-provider";

function renderList(onSave: (next: string[]) => Promise<void>) {
  return render(
    <WritingModeProvider isReadOnly={false}>
      <SentenceList
        role="cd"
        label="CD sentences"
        helpText=""
        sentences={["", ""]}
        onSave={onSave}
      />
    </WritingModeProvider>
  );
}

describe("Shaping SentenceList — concurrent slot edits", () => {
  it("persists every edited slot (no stale-snapshot clobber)", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderList(onSave);

    const fields = screen.getAllByRole("textbox");
    expect(fields).toHaveLength(2);

    // Edit slot 0 → "A" and save (revalidate "lag": prop stays ["", ""]).
    fireEvent.focus(fields[0]);
    fireEvent.change(fields[0], { target: { value: "A" } });
    fireEvent.blur(fields[0]);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // Edit slot 1 → "B" before the prop catches up.
    fireEvent.focus(fields[1]);
    fireEvent.change(fields[1], { target: { value: "B" } });
    fireEvent.blur(fields[1]);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    // The second save must include BOTH edits, not clobber slot 0 back to "".
    expect(onSave).toHaveBeenLastCalledWith(["A", "B"]);
  });
});
