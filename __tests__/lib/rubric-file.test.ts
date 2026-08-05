/**
 * The attached rubric document (assignments.rubric_file_*, migration 0049).
 *
 * Three things are load-bearing and pinned here:
 *   1. MIME resolution is driven by the EXTENSION, not the browser's reported
 *      type — Supabase matches the upload Content-Type against the bucket
 *      allowlist, and browsers report "" for Office files often enough that
 *      trusting them causes spurious rejections.
 *   2. `parseRubricFileInput` never throws on hostile input, and treats
 *      "absent", "blank", and "malformed" identically as "no document" —
 *      which is also how a removal arrives from the form.
 *   3. The teacher-folder guard. The server persists the posted path AND
 *      later deletes whatever the row used to point at, so a forged path is
 *      a delete primitive: save once to plant a colleague's path, save again
 *      to make the replace-sweep destroy their file. A school-wide check does
 *      not catch that — both teachers share a school — so the guard binds to
 *      the uploader.
 */

import { describe, it, expect } from "vitest";
import {
  checkRubricFile,
  isRubricFilePathForTeacher,
  parseRubricFileInput,
  resolveRubricFileMime,
  rubricFileLabel,
  rubricFolder,
  RUBRIC_FILE_ACCEPT,
  RUBRIC_FILE_MAX_BYTES,
} from "@/lib/rubric-file";

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("resolveRubricFileMime", () => {
  it("resolves the formats teachers actually bring", () => {
    expect(resolveRubricFileMime("rubric.pdf")).toBe("application/pdf");
    expect(resolveRubricFileMime("rubric.docx")).toBe(DOCX);
    expect(resolveRubricFileMime("rubric.xlsx")).toBe(XLSX);
    expect(resolveRubricFileMime("rubric.csv")).toBe("text/csv");
  });

  it("is case-insensitive on the extension", () => {
    expect(resolveRubricFileMime("RUBRIC.PDF")).toBe("application/pdf");
    expect(resolveRubricFileMime("Rubric.XlSx")).toBe(XLSX);
  });

  it("prefers the extension over a wrong reported type", () => {
    // Windows commonly reports octet-stream for .xlsx. Trusting it would send
    // a Content-Type the bucket allowlist rejects.
    expect(resolveRubricFileMime("rubric.xlsx", "application/octet-stream")).toBe(
      XLSX
    );
    expect(resolveRubricFileMime("rubric.docx", "")).toBe(DOCX);
  });

  it("falls back to a recognized reported type when there is no extension", () => {
    expect(resolveRubricFileMime("rubric", "application/pdf")).toBe(
      "application/pdf"
    );
  });

  it("rejects types the bucket does not allow", () => {
    expect(resolveRubricFileMime("rubric.exe")).toBeNull();
    expect(resolveRubricFileMime("rubric.zip", "application/zip")).toBeNull();
    expect(resolveRubricFileMime("rubric")).toBeNull();
  });

  it("does not treat a dotted filename stem as an extension", () => {
    expect(resolveRubricFileMime("grade.9.rubric.pdf")).toBe("application/pdf");
  });
});

describe("RUBRIC_FILE_ACCEPT", () => {
  it("offers both extensions and MIME types, since browsers vary", () => {
    expect(RUBRIC_FILE_ACCEPT).toContain(".xlsx");
    expect(RUBRIC_FILE_ACCEPT).toContain(XLSX);
    expect(RUBRIC_FILE_ACCEPT).toContain(".pdf");
  });
});

describe("checkRubricFile", () => {
  it("accepts a normal rubric and reports the resolved mime", () => {
    const res = checkRubricFile({
      name: "rubric.xlsx",
      type: "",
      size: 50_000,
    });
    expect(res).toEqual({ ok: true, mime: XLSX });
  });

  it("rejects an unsupported type with an actionable message", () => {
    const res = checkRubricFile({ name: "rubric.exe", type: "", size: 10 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(".pdf");
  });

  it("rejects a file over the bucket's size limit before uploading", () => {
    const res = checkRubricFile({
      name: "rubric.pdf",
      type: "application/pdf",
      size: RUBRIC_FILE_MAX_BYTES + 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("20 MB");
  });

  it("accepts a file exactly at the limit", () => {
    const res = checkRubricFile({
      name: "rubric.pdf",
      type: "application/pdf",
      size: RUBRIC_FILE_MAX_BYTES,
    });
    expect(res.ok).toBe(true);
  });
});

describe("rubricFileLabel", () => {
  it("names the format for the teacher", () => {
    expect(rubricFileLabel({ name: "r.pdf" })).toBe("PDF");
    expect(rubricFileLabel({ name: "r.xlsx" })).toBe("Excel workbook");
    expect(rubricFileLabel({ name: "r.docx" })).toBe("Word document");
  });

  it("falls back to the mime, then to a generic label", () => {
    expect(rubricFileLabel({ name: "rubric", mime: "application/pdf" })).toBe(
      "PDF"
    );
    expect(rubricFileLabel({ name: "rubric", mime: null })).toBe("Document");
  });
});

describe("parseRubricFileInput", () => {
  it("round-trips what the client posts", () => {
    const file = { path: "school-s1/assignment-a1/rubric/1-r.pdf", name: "r.pdf", mime: "application/pdf" };
    expect(parseRubricFileInput(JSON.stringify(file))).toEqual(file);
  });

  it("treats absent / blank / malformed alike as 'no document'", () => {
    // The blank string is how a REMOVAL arrives — the form posts an empty
    // hidden input rather than omitting the field.
    expect(parseRubricFileInput(null)).toBeNull();
    expect(parseRubricFileInput(undefined)).toBeNull();
    expect(parseRubricFileInput("")).toBeNull();
    expect(parseRubricFileInput("{not json")).toBeNull();
    expect(parseRubricFileInput("[]")).toBeNull();
    expect(parseRubricFileInput('"a string"')).toBeNull();
    expect(parseRubricFileInput("null")).toBeNull();
  });

  it("requires both path and name, since one without the other is unusable", () => {
    expect(parseRubricFileInput('{"path":"p"}')).toBeNull();
    expect(parseRubricFileInput('{"name":"r.pdf"}')).toBeNull();
    expect(parseRubricFileInput('{"path":"  ","name":"r.pdf"}')).toBeNull();
  });

  it("tolerates a missing mime — the CHECK constraint allows it", () => {
    expect(parseRubricFileInput('{"path":"p","name":"r.pdf"}')).toEqual({
      path: "p",
      name: "r.pdf",
      mime: "",
    });
  });

  it("ignores non-string fields rather than throwing", () => {
    expect(parseRubricFileInput('{"path":123,"name":"r.pdf"}')).toBeNull();
    expect(
      parseRubricFileInput('{"path":"p","name":"r.pdf","mime":{"x":1}}')
    ).toEqual({ path: "p", name: "r.pdf", mime: "" });
  });
});

describe("isRubricFilePathForTeacher", () => {
  const school = "11111111-1111-1111-1111-111111111111";
  const otherSchool = "22222222-2222-2222-2222-222222222222";
  const teacher = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const colleague = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("accepts a path the caller uploaded", () => {
    const path = `${rubricFolder(school, teacher)}123-r.pdf`;
    expect(isRubricFilePathForTeacher(path, school, teacher)).toBe(true);
  });

  it("rejects a colleague's path in the SAME school", () => {
    // The regression this guard exists for. A school-wide check passes here,
    // and then save #2 sweeps a file another teacher's row still points at.
    const forged = `${rubricFolder(school, colleague)}123-r.pdf`;
    expect(isRubricFilePathForTeacher(forged, school, teacher)).toBe(false);
  });

  it("rejects the same teacher id under another school", () => {
    const forged = `${rubricFolder(otherSchool, teacher)}123-r.pdf`;
    expect(isRubricFilePathForTeacher(forged, school, teacher)).toBe(false);
  });

  it("rejects a path that only embeds the right prefix later on", () => {
    expect(
      isRubricFilePathForTeacher(
        `${rubricFolder(school, colleague)}x/${rubricFolder(school, teacher)}r.pdf`,
        school,
        teacher
      )
    ).toBe(false);
  });

  it("rejects the legacy assignment-keyed folder shape", () => {
    // Nothing should have written these, but a stray column value must not
    // authorize a delete.
    expect(
      isRubricFilePathForTeacher(
        `school-${school}/assignment-a1/rubric/1-r.pdf`,
        school,
        teacher
      )
    ).toBe(false);
  });

  it("rejects traversal-style, sibling-prefix, and empty paths", () => {
    expect(isRubricFilePathForTeacher("../../etc/passwd", school, teacher)).toBe(
      false
    );
    expect(isRubricFilePathForTeacher("", school, teacher)).toBe(false);
    // `teacher-{id}2/` must not pass as `teacher-{id}/` — the trailing slash
    // in rubricFolder is what prevents the prefix-collision.
    expect(
      isRubricFilePathForTeacher(
        `school-${school}/teacher-${teacher}2/rubric/r.pdf`,
        school,
        teacher
      )
    ).toBe(false);
  });
});
