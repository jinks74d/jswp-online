/**
 * Characterization tests for lib/assignments/sources.ts.
 *
 * The load-bearing rule here is offset stability. The annotation engine stores
 * character offsets into `source_text`; if the value written at authoring time
 * differs by even one character from what the student's text layer renders,
 * every saved annotation on that source silently points at the wrong words.
 * Each render mode has its own reason for how it treats the text, so the
 * per-mode assertions below are contracts, not preferences.
 *
 * This module transitively imports lib/source-content, which is `server-only`.
 * vite.config.ts aliases that marker to test-stubs/server-only.ts; without it
 * these imports throw and the whole file is unreachable.
 */

import { describe, it, expect } from "vitest";
import {
  VALID_RENDER_MODES,
  parseSources,
  resolveSourceColumns,
  isEmptySource,
  type SourceInput,
  type SourceColumns,
} from "@/lib/assignments/sources";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

/** A fully-blank SourceInput; tests set only the fields they care about. */
function src(over: Partial<SourceInput> = {}): SourceInput {
  return {
    source_id: "",
    kind: "primary",
    source_title: "",
    source_author: "",
    source_citation: "",
    source_url: "",
    source_html: "",
    source_render_mode: "",
    source_text: "",
    source_file_path: "",
    source_file_name: "",
    source_file_mime: "",
    ...over,
  };
}

/** A fully-null SourceColumns, for isEmptySource cases. */
function cols(over: Partial<SourceColumns> = {}): SourceColumns {
  return {
    source_text: null,
    source_title: null,
    source_author: null,
    source_citation: null,
    source_url: null,
    source_html: null,
    source_render_mode: null,
    source_file_path: null,
    source_file_name: null,
    source_file_mime: null,
    ...over,
  };
}

describe("parseSources", () => {
  it("returns [] when absent or blank (narrative mode omits the field)", () => {
    expect(parseSources(fd({}))).toEqual([]);
    expect(parseSources(fd({ sources: "" }))).toEqual([]);
  });

  it("returns [] for malformed JSON rather than throwing", () => {
    expect(parseSources(fd({ sources: "{nope" }))).toEqual([]);
  });

  it("returns [] when the JSON is valid but not an array", () => {
    expect(parseSources(fd({ sources: '{"a":1}' }))).toEqual([]);
  });

  it("coerces every missing key to an empty string", () => {
    const out = parseSources(fd({ sources: "[{}]" }));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(src());
  });

  it("coerces non-string values to empty strings instead of leaking them", () => {
    const raw = JSON.stringify([
      { source_title: 42, source_url: null, source_text: { a: 1 } },
    ]);
    const out = parseSources(fd({ sources: raw }));
    expect(out[0].source_title).toBe("");
    expect(out[0].source_url).toBe("");
    expect(out[0].source_text).toBe("");
  });

  it('defaults kind to "primary" and only honours an exact "secondary"', () => {
    const raw = JSON.stringify([
      {},
      { kind: "secondary" },
      { kind: "SECONDARY" },
      { kind: "tertiary" },
    ]);
    expect(parseSources(fd({ sources: raw })).map((s) => s.kind)).toEqual([
      "primary",
      "secondary",
      "primary",
      "primary",
    ]);
  });

  it("survives null entries in the array", () => {
    const out = parseSources(fd({ sources: "[null]" }));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(src());
  });
});

describe("resolveSourceColumns — pdf preserves offsets", () => {
  it("stores pdf text VERBATIM, including leading and trailing whitespace", () => {
    // This is the whole ballgame for PDF annotations: source_text must stay
    // byte-for-byte equal to pdf.js's buildPdfText() output, which the student
    // text layer reproduces at render. Trimming shifts every stored offset.
    const text = "  Line one\n\n  Line two  ";
    const out = resolveSourceColumns(
      src({ source_render_mode: "pdf", source_text: text })
    );
    expect(out.source_text).toBe(text);
    expect(out.source_render_mode).toBe("pdf");
    expect(out.source_html).toBeNull();
  });

  it("nulls pdf text that is only whitespace", () => {
    const out = resolveSourceColumns(
      src({ source_render_mode: "pdf", source_text: "   \n  " })
    );
    expect(out.source_text).toBeNull();
  });
});

describe("resolveSourceColumns — rich derives its substrate", () => {
  it("derives source_text from the sanitized HTML, not the posted text", () => {
    // source_text is DERIVED so it always matches what gets rendered. A posted
    // source_text is ignored entirely in rich mode.
    const out = resolveSourceColumns(
      src({
        source_render_mode: "rich",
        source_html: "<p>Hello <em>world</em></p>",
        source_text: "IGNORED",
      })
    );
    expect(out.source_render_mode).toBe("rich");
    expect(out.source_text).toBe("Hello world");
    expect(out.source_html).toContain("Hello");
  });

  it("strips script tags out of the stored HTML", () => {
    const out = resolveSourceColumns(
      src({
        source_render_mode: "rich",
        source_html: '<p>Safe</p><script>alert("xss")</script>',
      })
    );
    expect(out.source_html).not.toContain("<script");
    expect(out.source_html).not.toContain("alert");
  });

  it("falls through to the plain branch when rich is declared with no HTML", () => {
    // The `mode === "rich" && src.source_html` guard means empty HTML does not
    // take the rich path; it lands in the tail branch with the posted text.
    const out = resolveSourceColumns(
      src({ source_render_mode: "rich", source_html: "", source_text: "typed" })
    );
    expect(out.source_text).toBe("typed");
    expect(out.source_render_mode).toBe("rich");
  });
});

describe("resolveSourceColumns — image carries no substrate", () => {
  it("drops posted text and html, because offsets into a picture are meaningless", () => {
    const out = resolveSourceColumns(
      src({
        source_render_mode: "image",
        source_text: "should be dropped",
        source_html: "<p>also dropped</p>",
        source_file_path: "school-1/teacher-2/img.png",
      })
    );
    expect(out.source_text).toBeNull();
    expect(out.source_html).toBeNull();
    expect(out.source_render_mode).toBe("image");
    expect(out.source_file_path).toBe("school-1/teacher-2/img.png");
  });
});

describe("resolveSourceColumns — plain and unrecognised modes", () => {
  it('infers "plain" when no mode is given but text was typed', () => {
    const out = resolveSourceColumns(src({ source_text: "Some typed text" }));
    expect(out.source_render_mode).toBe("plain");
    expect(out.source_text).toBe("Some typed text");
  });

  it("leaves the mode null when nothing was typed and none was given", () => {
    expect(resolveSourceColumns(src()).source_render_mode).toBeNull();
  });

  it("treats an unrecognised mode as absent rather than persisting it", () => {
    const out = resolveSourceColumns(
      src({ source_render_mode: "wingdings", source_text: "text" })
    );
    expect(out.source_render_mode).toBe("plain");
  });

  it("trims plain text, unlike pdf", () => {
    // Safe here: plain text has no external substrate to stay aligned with.
    const out = resolveSourceColumns(
      src({ source_render_mode: "plain", source_text: "  padded  " })
    );
    expect(out.source_text).toBe("padded");
  });

  it("trims metadata fields in every mode", () => {
    const out = resolveSourceColumns(
      src({ source_title: "  Frost  ", source_author: "  R.F.  " })
    );
    expect(out.source_title).toBe("Frost");
    expect(out.source_author).toBe("R.F.");
  });
});

describe("isEmptySource", () => {
  it("is true for a row with no body, no file and no metadata", () => {
    expect(isEmptySource(cols())).toBe(true);
  });

  it("is false when any body, file or metadata field is set", () => {
    const fields: (keyof SourceColumns)[] = [
      "source_text",
      "source_html",
      "source_file_path",
      "source_title",
      "source_author",
      "source_citation",
      "source_url",
    ];
    for (const f of fields) {
      expect(isEmptySource(cols({ [f]: "x" }))).toBe(false);
    }
  });

  it("ignores file_name and file_mime — they cannot save an otherwise blank row", () => {
    // Deliberate: a name/mime with no path is debris from a failed upload, not
    // a source worth persisting.
    expect(
      isEmptySource(cols({ source_file_name: "a.pdf", source_file_mime: "application/pdf" }))
    ).toBe(true);
  });

  it("ignores render_mode alone", () => {
    expect(isEmptySource(cols({ source_render_mode: "plain" }))).toBe(true);
  });
});

describe("VALID_RENDER_MODES", () => {
  it("lists exactly the four render modes the schema allows", () => {
    expect([...VALID_RENDER_MODES].sort()).toEqual([
      "image",
      "pdf",
      "plain",
      "rich",
    ]);
  });
});
