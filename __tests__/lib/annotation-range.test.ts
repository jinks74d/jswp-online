import { describe, it, expect } from "vitest";
import { resolveAnnotationRange } from "@/lib/annotation-range";

const TEXT =
  "In 1894, Anne DeGraf set out for the Yukon. The fifty-five-year-old woman " +
  "traveled across the Chilkoot Pass. With her feet\nwrapped in rags, she " +
  "walked with the aid of a crutch. She sold her sewing machine and took her " +
  "earnings home. She had $1,200 in gold dust.";

function at(snippet: string, offsetOverride?: number) {
  const start = offsetOverride ?? TEXT.indexOf(snippet);
  return {
    range_start: start,
    range_end: start + snippet.length,
    selected_text: snippet,
  };
}

describe("resolveAnnotationRange", () => {
  it("leaves a still-valid range untouched", () => {
    const stored = at("sewing machine");
    expect(resolveAnnotationRange(TEXT, stored)).toEqual({
      start: stored.range_start,
      end: stored.range_end,
      relocated: false,
    });
  });

  it("re-locates a range whose offsets drifted", () => {
    // The real failure: 2026-07-23 margin stripping shortened the substrate, so
    // stored offsets pointed ~150 chars downstream of the student's words.
    const stored = { ...at("fifty-five-year-old woman"), range_start: 0, range_end: 25 };
    const resolved = resolveAnnotationRange(TEXT, { ...stored });
    expect(resolved?.relocated).toBe(true);
    expect(TEXT.slice(resolved!.start, resolved!.end)).toBe(
      "fifty-five-year-old woman"
    );
  });

  it("matches across a line break the extraction re-flowed", () => {
    // Stored with a space; the substrate now has a newline mid-phrase.
    const stored = {
      range_start: 0,
      range_end: 40,
      selected_text: "her feet wrapped in rags, she walked",
    };
    const resolved = resolveAnnotationRange(TEXT, stored);
    expect(resolved?.relocated).toBe(true);
    expect(TEXT.slice(resolved!.start, resolved!.end)).toBe(
      "her feet\nwrapped in rags, she walked"
    );
  });

  it("prefers the occurrence nearest the stored offset when ambiguous", () => {
    const twice = "alpha needle beta needle gamma";
    const second = twice.lastIndexOf("needle");
    const resolved = resolveAnnotationRange(twice, {
      range_start: second + 3, // drifted slightly past the SECOND occurrence
      range_end: second + 9,
      selected_text: "needle",
    });
    expect(resolved).toEqual({
      start: second,
      end: second + 6,
      relocated: true,
    });
  });

  it("returns null when the words are gone from the source entirely", () => {
    expect(
      resolveAnnotationRange(TEXT, {
        range_start: 5,
        range_end: 20,
        selected_text: "a phrase never present",
      })
    ).toBeNull();
  });

  it("returns null for an empty snippet rather than matching everywhere", () => {
    expect(
      resolveAnnotationRange(TEXT, {
        range_start: 5,
        range_end: 5,
        selected_text: "",
      })
    ).toBeNull();
  });

  it("does not report relocation when the stored range is already exact", () => {
    // Guards the cheap path: an exact hit must never be re-searched and
    // re-anchored onto a different, equal-looking occurrence.
    const twice = "needle and needle";
    expect(
      resolveAnnotationRange(twice, {
        range_start: 11,
        range_end: 17,
        selected_text: "needle",
      })
    ).toEqual({ start: 11, end: 17, relocated: false });
  });
});
