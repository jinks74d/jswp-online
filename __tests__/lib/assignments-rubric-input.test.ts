/**
 * Characterization tests for lib/assignments/rubric-input.ts.
 *
 * Two things are pinned here. The mundane one is that a blank or malformed
 * rubric field never crashes a teacher's save. The load-bearing one is
 * resolveRubricFile's ownership check: the posted storage key is untrusted
 * input that the server both persists AND later deletes, so accepting a
 * forged path turns the next save into a delete of someone else's file.
 * See the comment on isRubricFilePathForTeacher in lib/rubric-file.ts.
 */

import { describe, it, expect } from "vitest";
import {
  parseAndValidateRubric,
  resolveRubricFile,
  rubricFileColumns,
} from "@/lib/assignments/rubric-input";

const SCHOOL = "11111111-1111-1111-1111-111111111111";
const TEACHER = "22222222-2222-2222-2222-222222222222";
const OTHER_TEACHER = "33333333-3333-3333-3333-333333333333";

/** The folder layout isRubricFilePathForTeacher enforces. */
const ownFolder = `school-${SCHOOL}/teacher-${TEACHER}/rubric/`;
const otherFolder = `school-${SCHOOL}/teacher-${OTHER_TEACHER}/rubric/`;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

/** A valid RubricLevel: { score, label, description } — see lib/rubric.ts. */
function level(over: Record<string, unknown> = {}) {
  return { score: 1, label: "Developing", description: "", ...over };
}

function fileField(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    path: `${ownFolder}rubric.pdf`,
    name: "rubric.pdf",
    mime: "application/pdf",
    ...over,
  });
}

describe("parseAndValidateRubric", () => {
  it("treats an absent field as an empty rubric, not an error", () => {
    // "null and { criteria: [] } are the same thing" — an assignment with no
    // rubric is normal, so this must not be a validation failure.
    const r = parseAndValidateRubric(fd({}));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rubric).toEqual({ criteria: [] });
  });

  it("treats a blank field as an empty rubric", () => {
    const r = parseAndValidateRubric(fd({ rubric: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rubric).toEqual({ criteria: [] });
  });

  it("reports malformed JSON as a field error rather than throwing", () => {
    const r = parseAndValidateRubric(fd({ rubric: "{not json" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.rubric).toBe("Rubric is malformed JSON.");
    }
  });

  it("surfaces the validator's own message for a bad shape", () => {
    const r = parseAndValidateRubric(fd({ rubric: '{"criteria":"nope"}' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.rubric).toBe(
        "Rubric.criteria must be an array."
      );
    }
  });

  it("names the offending criterion so the teacher can find it", () => {
    const raw = JSON.stringify({
      criteria: [
        { id: "a", name: "Fine", levels: [level()] },
        { id: "b", name: "", levels: [level()] },
      ],
    });
    const r = parseAndValidateRubric(fd({ rubric: raw }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.rubric).toBe(
        "Criterion 2: specific skill is required."
      );
    }
  });

  it("accepts a well-formed rubric and returns the normalized value", () => {
    const raw = JSON.stringify({
      criteria: [
        {
          id: "c1",
          name: "Commentary depth",
          levels: [level({ score: 3, label: "Proficient" })],
        },
      ],
    });
    const r = parseAndValidateRubric(fd({ rubric: raw }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rubric.criteria).toHaveLength(1);
      expect(r.rubric.criteria[0].name).toBe("Commentary depth");
    }
  });

  it("accepts an explicitly empty criteria array", () => {
    const r = parseAndValidateRubric(fd({ rubric: '{"criteria":[]}' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rubric).toEqual({ criteria: [] });
  });
});

describe("resolveRubricFile — ownership is load-bearing", () => {
  it("accepts a path under the caller's own folder", () => {
    const r = resolveRubricFile(fd({ rubric_file: fileField() }), SCHOOL, TEACHER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file?.path).toBe(`${ownFolder}rubric.pdf`);
  });

  it("REJECTS a path under a colleague's folder in the same school", () => {
    // The attack this stops: save 1 points the row at a colleague's object,
    // save 2 makes the replace-sweep delete it. A school-wide check would
    // pass this, which is exactly why the folder is keyed to the teacher.
    const r = resolveRubricFile(
      fd({ rubric_file: fileField({ path: `${otherFolder}theirs.pdf` }) }),
      SCHOOL,
      TEACHER
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.state.fieldErrors?.rubric_file).toBe(
        "That rubric file wasn't uploaded from this form. Re-select it and save again."
      );
    }
  });

  it("rejects a path that escapes the folder prefix entirely", () => {
    for (const path of [
      "rubric.pdf",
      `school-${SCHOOL}/rubric.pdf`,
      `../${ownFolder}rubric.pdf`,
    ]) {
      const r = resolveRubricFile(fd({ rubric_file: fileField({ path }) }), SCHOOL, TEACHER);
      expect(r.ok).toBe(false);
    }
  });

  it("treats an absent field as 'no rubric document', which is also how removal arrives", () => {
    const r = resolveRubricFile(fd({}), SCHOOL, TEACHER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file).toBeNull();
  });

  it("treats malformed input as absent rather than as an error", () => {
    for (const raw of ["", "{not json", "[]", '{"path":"x"}', '{"name":"y"}']) {
      const r = resolveRubricFile(fd({ rubric_file: raw }), SCHOOL, TEACHER);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.file).toBeNull();
    }
  });

  it("scopes by school as well as teacher", () => {
    const otherSchool = "44444444-4444-4444-4444-444444444444";
    const r = resolveRubricFile(
      fd({ rubric_file: fileField() }),
      otherSchool,
      TEACHER
    );
    expect(r.ok).toBe(false);
  });
});

describe("rubricFileColumns", () => {
  it("maps a file onto its three columns", () => {
    expect(
      rubricFileColumns({ path: "p", name: "n.pdf", mime: "application/pdf" })
    ).toEqual({
      rubric_file_path: "p",
      rubric_file_name: "n.pdf",
      rubric_file_mime: "application/pdf",
    });
  });

  it("nulls all three when there is no file — this is how a removal persists", () => {
    expect(rubricFileColumns(null)).toEqual({
      rubric_file_path: null,
      rubric_file_name: null,
      rubric_file_mime: null,
    });
  });

  it('converts an unknown ("") mime to null, unlike path and name', () => {
    // mime uses `||` where path/name use `??`, so "" becomes null. That is
    // deliberate: parseRubricFileInput yields "" when the type could not be
    // determined, and an empty-string MIME column would be meaningless.
    expect(rubricFileColumns({ path: "p", name: "n", mime: "" })).toEqual({
      rubric_file_path: "p",
      rubric_file_name: "n",
      rubric_file_mime: null,
    });
  });
});
