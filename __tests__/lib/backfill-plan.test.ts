/**
 * Decision logic for the source_html backfill (scripts/backfill-source-html).
 * This is the part where a wrong branch corrupts live data, so it is a pure,
 * tested function separate from the I/O runner.
 */

import { describe, it, expect } from "vitest";
import { planBackfill } from "@/scripts/backfill-plan";

describe("planBackfill", () => {
  it("skips when there is no stored original file", () => {
    expect(
      planBackfill({
        hasFile: false,
        isDocx: false,
        oldText: "x",
        newSubstrate: "x",
        annotationCount: 0,
      })
    ).toEqual({ action: "skip", reason: "no-file" });
  });

  it("skips a non-docx file (only .docx is re-convertible here)", () => {
    expect(
      planBackfill({
        hasFile: true,
        isDocx: false,
        oldText: "x",
        newSubstrate: "x",
        annotationCount: 0,
      })
    ).toEqual({ action: "skip", reason: "not-docx" });
  });

  it("updates with no risk when the substrate is unchanged", () => {
    expect(
      planBackfill({
        hasFile: true,
        isDocx: true,
        oldText: "AB",
        newSubstrate: "AB",
        annotationCount: 5,
      })
    ).toEqual({ action: "update", textChanged: false, annotationsAtRisk: false });
  });

  it("updates and flags risk when text changed and annotations exist", () => {
    expect(
      planBackfill({
        hasFile: true,
        isDocx: true,
        oldText: "AB",
        newSubstrate: "ABC",
        annotationCount: 3,
      })
    ).toEqual({ action: "update", textChanged: true, annotationsAtRisk: true });
  });

  it("updates without risk when text changed but no annotations exist", () => {
    expect(
      planBackfill({
        hasFile: true,
        isDocx: true,
        oldText: "AB",
        newSubstrate: "ABC",
        annotationCount: 0,
      })
    ).toEqual({ action: "update", textChanged: true, annotationsAtRisk: false });
  });
});
