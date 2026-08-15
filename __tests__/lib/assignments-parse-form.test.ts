/**
 * Characterization tests for lib/assignments/parse-form.ts.
 *
 * These pin CURRENT behaviour, quirks included — they exist so a later
 * refactor of the assignment-authoring path cannot change what a teacher's
 * form post means without a test going red. Where a rule looks surprising,
 * the comment says why it is deliberate rather than quietly "fixing" it.
 *
 * This logic was unreachable from a test until it moved out of
 * lib/actions/assignments.ts: that module is "use server", where every export
 * must be an async function, so none of these could be exported.
 */

import { describe, it, expect } from "vitest";
import {
  VALID_MODES,
  VALID_RATIOS,
  parseTimestamp,
  emptyToNull,
  parseClassPeriods,
  parseCommonFields,
  validateCommon,
} from "@/lib/assignments/parse-form";

/** Build a FormData from a plain object; omitted keys are genuinely absent. */
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

/** A form post that passes validateCommon, so each test can vary one field. */
function validForm(over: Record<string, string> = {}): FormData {
  return fd({
    title: "Water scarcity",
    prompt: "Explain the causes of water scarcity.",
    due_at: "2026-09-01T12:00:00.000Z",
    ...over,
  });
}

describe("parseTimestamp", () => {
  it("returns null for an empty string rather than the epoch", () => {
    // new Date("") is Invalid Date, but new Date(0) would be 1970 — the early
    // return is what stops a blank due-date field becoming a 1970 deadline.
    expect(parseTimestamp("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(parseTimestamp("not a date")).toBeNull();
  });

  it("normalises a parseable date to ISO 8601", () => {
    expect(parseTimestamp("2026-09-01T12:00:00.000Z")).toBe(
      "2026-09-01T12:00:00.000Z"
    );
  });

  it("accepts the datetime-local format the form actually posts", () => {
    // <input type="datetime-local"> posts without a zone; Date treats it as
    // local time. We assert the shape, not the instant, so the test does not
    // depend on the machine's timezone.
    expect(parseTimestamp("2026-09-01T12:00")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });
});

describe("emptyToNull", () => {
  it("maps empty and whitespace-only to null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
  });

  it("trims surrounding whitespace off a real value", () => {
    expect(emptyToNull("  Frost  ")).toBe("Frost");
  });
});

describe("parseClassPeriods", () => {
  it("returns [] when the field is absent or blank", () => {
    expect(parseClassPeriods(fd({}))).toEqual([]);
    expect(parseClassPeriods(fd({ class_periods: "" }))).toEqual([]);
  });

  it("returns [] for malformed JSON instead of throwing", () => {
    // A thrown parse error here would surface to the teacher as a crash on
    // save. Empty means "no periods selected", which validateCommon can and
    // does report properly.
    expect(parseClassPeriods(fd({ class_periods: "{oops" }))).toEqual([]);
  });

  it("returns [] when the JSON is valid but not an array", () => {
    expect(parseClassPeriods(fd({ class_periods: '{"a":1}' }))).toEqual([]);
  });

  it("collapses duplicate period ids rather than rejecting the save", () => {
    const raw = JSON.stringify([
      { class_period_id: "p1", due_at: null },
      { class_period_id: "p1", due_at: null },
    ]);
    expect(parseClassPeriods(fd({ class_periods: raw }))).toEqual([
      { class_period_id: "p1", due_at: null },
    ]);
  });

  it("keeps the FIRST occurrence of a duplicated id, discarding later due_at", () => {
    const raw = JSON.stringify([
      { class_period_id: "p1", due_at: "2026-09-01T12:00:00.000Z" },
      { class_period_id: "p1", due_at: "2026-12-25T12:00:00.000Z" },
    ]);
    expect(parseClassPeriods(fd({ class_periods: raw }))).toEqual([
      { class_period_id: "p1", due_at: "2026-09-01T12:00:00.000Z" },
    ]);
  });

  it("trims ids and drops blank or non-string ones", () => {
    const raw = JSON.stringify([
      { class_period_id: "  p1  " },
      { class_period_id: "   " },
      { class_period_id: 42 },
      { class_period_id: null },
      "not an object",
      null,
    ]);
    expect(parseClassPeriods(fd({ class_periods: raw }))).toEqual([
      { class_period_id: "p1", due_at: null },
    ]);
  });

  it("nulls a due_at that is present but unparseable", () => {
    const raw = JSON.stringify([
      { class_period_id: "p1", due_at: "garbage" },
    ]);
    expect(parseClassPeriods(fd({ class_periods: raw }))).toEqual([
      { class_period_id: "p1", due_at: null },
    ]);
  });

  it("nulls a non-string due_at without dropping the period", () => {
    const raw = JSON.stringify([{ class_period_id: "p1", due_at: 1234 }]);
    expect(parseClassPeriods(fd({ class_periods: raw }))).toEqual([
      { class_period_id: "p1", due_at: null },
    ]);
  });
});

describe("parseCommonFields", () => {
  it("defaults counts to 1 and the ratio to expository 2+:1", () => {
    const f = parseCommonFields(fd({}));
    expect(f.numBodyParagraphs).toBe(1);
    expect(f.defaultChunksPerBp).toBe(1);
    expect(f.chunkRatioRaw).toBe("nonlit_expository_two_plus_to_one");
  });

  it("trims title and prompt", () => {
    const f = parseCommonFields(fd({ title: "  T  ", prompt: "  P  " }));
    expect(f.title).toBe("T");
    expect(f.prompt).toBe("P");
  });

  it('treats both "on" and "true" as a checked checkbox', () => {
    // "on" is what a real <input type="checkbox"> posts; "true" is what the
    // controlled React inputs in assignment-form.tsx post.
    expect(parseCommonFields(fd({ is_essay: "on" })).isEssay).toBe(true);
    expect(parseCommonFields(fd({ is_essay: "true" })).isEssay).toBe(true);
    expect(
      parseCommonFields(fd({ has_counterargument: "on" })).hasCounterargument
    ).toBe(true);
  });

  it("treats any other checkbox value as unchecked", () => {
    expect(parseCommonFields(fd({ is_essay: "yes" })).isEssay).toBe(false);
    expect(parseCommonFields(fd({ is_essay: "1" })).isEssay).toBe(false);
  });

  it("mirrors the first selected period into the legacy classPeriodId column", () => {
    const raw = JSON.stringify([
      { class_period_id: "first" },
      { class_period_id: "second" },
    ]);
    const f = parseCommonFields(fd({ class_periods: raw }));
    expect(f.classPeriodId).toBe("first");
    expect(f.periods).toHaveLength(2);
  });

  it("leaves classPeriodId null when no periods were selected", () => {
    expect(parseCommonFields(fd({})).classPeriodId).toBeNull();
  });
});

describe("validateCommon — required fields", () => {
  it("rejects a missing title", () => {
    const r = validateCommon(parseCommonFields(validForm({ title: "" })), "expository");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.state.fieldErrors?.title).toBe("Title is required.");
  });

  it("rejects a title over 255 characters but accepts exactly 255", () => {
    const at = validateCommon(
      parseCommonFields(validForm({ title: "x".repeat(255) })),
      "expository"
    );
    expect(at.ok).toBe(true);

    const over = validateCommon(
      parseCommonFields(validForm({ title: "x".repeat(256) })),
      "expository"
    );
    expect(over.ok).toBe(false);
  });

  it("rejects a missing prompt", () => {
    const r = validateCommon(parseCommonFields(validForm({ prompt: "" })), "expository");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.state.fieldErrors?.prompt).toBe("Prompt is required.");
  });

  it("rejects a prompt over 5000 characters but accepts exactly 5000", () => {
    expect(
      validateCommon(
        parseCommonFields(validForm({ prompt: "x".repeat(5000) })),
        "expository"
      ).ok
    ).toBe(true);
    expect(
      validateCommon(
        parseCommonFields(validForm({ prompt: "x".repeat(5001) })),
        "expository"
      ).ok
    ).toBe(false);
  });

  it("requires a due date", () => {
    const r = validateCommon(parseCommonFields(validForm({ due_at: "" })), "expository");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.state.fieldErrors?.due_at).toBe("Due date is required.");
  });
});

describe("validateCommon — mode-specific rules", () => {
  it("forces literary to the 1:2+ ratio even when another is posted", () => {
    // Migration 0038's CHECK constraint rejects a literary assignment carrying
    // a non-literary ratio, so this coercion is what keeps the write legal.
    const r = validateCommon(
      parseCommonFields(
        validForm({ default_chunk_ratio: "nonlit_expository_two_plus_to_one" })
      ),
      "literary"
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.chunkRatio).toBe("lit_one_to_two_plus");
  });

  it("rejects an unrecognised ratio for a non-literary mode", () => {
    const r = validateCommon(
      parseCommonFields(validForm({ default_chunk_ratio: "made_up" })),
      "expository"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.state.error).toBe("Invalid chunk ratio.");
  });

  it("keeps has_counterargument only for argumentation", () => {
    const arg = validateCommon(
      parseCommonFields(validForm({ has_counterargument: "on" })),
      "argumentation"
    );
    expect(arg.ok && arg.hasCounterargument).toBe(true);

    // Silently coerced, not rejected: the flag is an argumentation-only column
    // and a stale checkbox from a mode switch should not fail the save.
    for (const mode of ["expository", "literary", "narrative"] as const) {
      const other = validateCommon(
        parseCommonFields(validForm({ has_counterargument: "on" })),
        mode
      );
      expect(other.ok && other.hasCounterargument).toBe(false);
    }
  });
});

describe("validateCommon — structural bounds", () => {
  it("requires an essay to have at least 2 body paragraphs", () => {
    const r = validateCommon(
      parseCommonFields(validForm({ is_essay: "on", num_body_paragraphs: "1" })),
      "expository"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.num_body_paragraphs).toBe(
        "Essays need at least 2 body paragraphs."
      );
    }
  });

  it("accepts 1 body paragraph when it is not an essay", () => {
    expect(
      validateCommon(
        parseCommonFields(validForm({ num_body_paragraphs: "1" })),
        "expository"
      ).ok
    ).toBe(true);
  });

  it("bounds body paragraphs to 1-10, matching the schema CHECK", () => {
    for (const n of ["0", "11"]) {
      expect(
        validateCommon(
          parseCommonFields(validForm({ num_body_paragraphs: n })),
          "expository"
        ).ok
      ).toBe(false);
    }
    for (const n of ["1", "10"]) {
      expect(
        validateCommon(
          parseCommonFields(validForm({ num_body_paragraphs: n })),
          "expository"
        ).ok
      ).toBe(true);
    }
  });

  it("bounds chunks per body paragraph to 1-5", () => {
    for (const n of ["0", "6"]) {
      expect(
        validateCommon(
          parseCommonFields(validForm({ default_chunks_per_bp: n })),
          "expository"
        ).ok
      ).toBe(false);
    }
    for (const n of ["1", "5"]) {
      expect(
        validateCommon(
          parseCommonFields(validForm({ default_chunks_per_bp: n })),
          "expository"
        ).ok
      ).toBe(true);
    }
  });

  it("checks the essay rule before the 1-10 bound", () => {
    // Both rules reject num_body_paragraphs=0 for an essay. Pinning which
    // message wins keeps the teacher-facing copy stable under refactor.
    const r = validateCommon(
      parseCommonFields(validForm({ is_essay: "on", num_body_paragraphs: "0" })),
      "expository"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.num_body_paragraphs).toBe(
        "Essays need at least 2 body paragraphs."
      );
    }
  });
});

describe("mode and ratio vocabularies", () => {
  it("lists exactly the four JSWP modes", () => {
    expect([...VALID_MODES].sort()).toEqual([
      "argumentation",
      "expository",
      "literary",
      "narrative",
    ]);
  });

  it("accepts every ratio the jswp_chunk_ratio enum defines", () => {
    // Drifting from the enum means a ratio the DB accepts is refused here (or
    // vice versa), so this list is a contract with migration 0038.
    expect([...VALID_RATIOS].sort()).toEqual([
      "lit_one_to_two_plus",
      "lit_three_plus_to_zero",
      "nar_two_plus_to_one",
      "nonlit_argumentation_two_plus_to_one",
      "nonlit_expository_one_to_one",
      "nonlit_expository_two_plus_to_one",
      "nonlit_summary_three_plus_to_zero",
    ]);
  });
});
