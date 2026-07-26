/**
 * The T-Chart's Continue gate — specifically the Embedding Quotations rule
 * added 2026-07-26: a CD marked as a quotation must carry the student's own
 * quotation marks before the writing can advance. The app stopped adding
 * them (see lib/quotation-marks.ts), so the gate is what makes placing them
 * a requirement rather than a suggestion.
 *
 * The rule is position-lenient by design: a blended quotation, where quoted
 * fragments sit inside the student's own words, is correct JSWP and must
 * pass. See the guide's p.79 example.
 */

import { describe, it, expect } from "vitest";
import { computeGate } from "@/components/student/writing/t-chart/compute-gate";
import type {
  BodyParagraphData,
  ConcreteDetailData,
} from "@/lib/queries/t-charts";

function cd(overrides: Partial<ConcreteDetailData> = {}): ConcreteDetailData {
  return {
    id: "cd1",
    position: 1,
    text: "Anne DeGraff carried a sewing machine",
    is_quotation: false,
    transitional_lead_in: null,
    source_citation: null,
    ...overrides,
  } as ConcreteDetailData;
}

function bp(cds: ConcreteDetailData[]): BodyParagraphData {
  return {
    id: "bp1",
    position: 1,
    label: null,
    num_chunks: 1,
    has_counterargument: false,
    t_chart: null,
    chunks: [
      { id: "c1", position: 1, ratio: "nonlit_expository_two_plus_to_one",
        concrete_details: cds, commentary_items: [] },
    ],
  } as unknown as BodyParagraphData;
}

describe("computeGate — Embedding Quotations", () => {
  it("blocks a quotation CD with no quotation marks", () => {
    const gate = computeGate("expository", [
      bp([cd({ is_quotation: true, text: "the woods are lovely" })]),
    ]);

    expect(gate.canContinue).toBe(false);
    expect(gate.blockerKind).toBe("quotation");
    expect(gate.blockerLabel).toBe("1st Chunk, 1st CD");
  });

  it("blocks a quotation CD with only an opening mark", () => {
    const gate = computeGate("expository", [
      bp([cd({ is_quotation: true, text: '"the woods are lovely' })]),
    ]);

    expect(gate.canContinue).toBe(false);
    expect(gate.blockerKind).toBe("quotation");
  });

  it("passes a fully quoted CD", () => {
    const gate = computeGate("expository", [
      bp([cd({ is_quotation: true, text: '"the woods are lovely"' })]),
    ]);

    expect(gate.canContinue).toBe(true);
  });

  it("passes a blended quotation — the guide's own p.79 example", () => {
    const gate = computeGate("expository", [
      bp([
        cd({
          is_quotation: true,
          text: 'This "fifty-five-year-old woman" with her "feet wrapped in rags"',
        }),
      ]),
    ]);

    expect(gate.canContinue).toBe(true);
  });

  it("ignores a CD that was never marked as a quotation", () => {
    const gate = computeGate("expository", [
      bp([cd({ is_quotation: false, text: "no marks here at all" })]),
    ]);

    expect(gate.canContinue).toBe(true);
  });

  it("ignores an empty quotation CD — nothing typed is not yet a mistake", () => {
    const gate = computeGate("expository", [
      bp([
        cd({ id: "cd1", is_quotation: false, text: "a real detail" }),
        cd({ id: "cd2", position: 2, is_quotation: true, text: "   " }),
      ]),
    ]);

    expect(gate.canContinue).toBe(true);
  });

  it("names the offending CD by chunk and position", () => {
    const gate = computeGate("expository", [
      bp([
        cd({ id: "cd1", position: 1, is_quotation: true, text: '"quoted"' }),
        cd({ id: "cd2", position: 2, is_quotation: true, text: "unquoted" }),
      ]),
    ]);

    expect(gate.blockerLabel).toBe("1st Chunk, 2nd CD");
  });

  it("still blocks first on a body paragraph with no concrete details", () => {
    const gate = computeGate("expository", [bp([cd({ text: "" })])]);

    expect(gate.canContinue).toBe(false);
    expect(gate.blockerKind).toBe("cdcm");
  });

  it("applies to argumentation and literary too — CdEditor is shared", () => {
    for (const mode of ["argumentation", "literary"] as const) {
      const gate = computeGate(mode, [
        bp([cd({ is_quotation: true, text: "no marks" })]),
      ]);
      expect(gate.blockerKind).toBe("quotation");
    }
  });

  it("does not apply to narrative, which has no CD quotation flow", () => {
    const narrativeBp = {
      ...bp([cd({ is_quotation: true, text: "no marks" })]),
      t_chart: { narrative_kind: "personal", narrative_when: "Last summer" },
    } as unknown as BodyParagraphData;

    expect(computeGate("narrative", [narrativeBp]).blockerKind).not.toBe(
      "quotation"
    );
  });
});
