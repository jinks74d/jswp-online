import { describe, it, expect } from "vitest";
import {
  printPathFor,
  printDocumentTitle,
  printHeaderLines,
  type PrintSourceMeta,
} from "@/components/student/writing/print/print-source-plan";

const META: PrintSourceMeta = {
  studentName: "Alex Rivera",
  assignmentTitle: "The Cost of Convenience",
  modeLabel: "Expository / Informational",
  draftNumber: 1,
};

describe("printPathFor", () => {
  it("prints pasted plain text in-app", () => {
    expect(printPathFor("plain", false, true)).toBe("in_app");
  });

  it("prints .docx-derived rich text in-app even though a file exists", () => {
    // The rich substrate is a faithful projection of the .docx, and we can lay
    // it out double-spaced — better for annotating than the original file.
    expect(printPathFor("rich", true, true)).toBe("in_app");
  });

  it("hands a PDF off to the browser so the real layout survives", () => {
    expect(printPathFor("pdf", true, true)).toBe("original");
  });

  it("hands an image off to the browser", () => {
    expect(printPathFor("image", true, false)).toBe("original");
  });

  it("offers nothing for an image with no file", () => {
    expect(printPathFor("image", false, false)).toBe("unavailable");
  });

  it("offers nothing when there is neither text nor file", () => {
    expect(printPathFor("plain", false, false)).toBe("unavailable");
  });

  it("falls back to in-app text for a fileless PDF row", () => {
    expect(printPathFor("pdf", false, true)).toBe("in_app");
  });

  it("treats a legacy null render mode as printable text", () => {
    expect(printPathFor(null, false, true)).toBe("in_app");
  });
});

describe("printDocumentTitle", () => {
  it("prefers the source's own title", () => {
    expect(printDocumentTitle(META, "Plastic in the Pacific")).toBe(
      "Plastic in the Pacific — Alex Rivera"
    );
  });

  it("falls back to the assignment title", () => {
    expect(printDocumentTitle(META, null)).toBe(
      "The Cost of Convenience — Alex Rivera"
    );
  });

  it("drops the dash when the student has no name on file", () => {
    expect(printDocumentTitle({ ...META, studentName: "" }, "Ozymandias")).toBe(
      "Ozymandias"
    );
  });

  it("ignores a whitespace-only source title", () => {
    expect(printDocumentTitle(META, "   ")).toBe(
      "The Cost of Convenience — Alex Rivera"
    );
  });
});

describe("printHeaderLines", () => {
  it("names the student and the assignment, then the provenance", () => {
    expect(printHeaderLines(META, "Aug 12, 2026")).toEqual([
      "Alex Rivera · The Cost of Convenience",
      "Expository / Informational · printed Aug 12, 2026",
    ]);
  });

  it("names the draft only past the first", () => {
    const [, provenance] = printHeaderLines(
      { ...META, draftNumber: 2 },
      "Aug 12, 2026"
    );
    expect(provenance).toBe(
      "Expository / Informational · printed Aug 12, 2026 · Draft 2"
    );
  });

  it("omits the date before mount rather than printing a stray separator", () => {
    expect(printHeaderLines(META, "")).toEqual([
      "Alex Rivera · The Cost of Convenience",
      "Expository / Informational",
    ]);
  });

  it("survives a student with no name on file", () => {
    const [identity] = printHeaderLines({ ...META, studentName: "" }, "x");
    expect(identity).toBe("The Cost of Convenience");
  });
});
