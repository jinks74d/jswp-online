/**
 * The T-Chart step's Continue gate — what a body paragraph owes before the
 * student can advance. Extracted from t-chart-client.tsx so it is unit
 * testable without dragging the component tree (and its `server-only`
 * query imports) into jsdom, matching the elaboration step's compute-gate.
 *
 * Rules, in the order they fire per body paragraph:
 *   fictional narrative → some ABC planning
 *   other narrative     → at least one WOW detail
 *   everything else     → at least one concrete detail,
 *                         then every quotation CD carries quotation marks
 *
 * Tested in __tests__/components/t-chart-gate.test.ts.
 */

import { hasQuotationPair } from "@/lib/quotation-marks";
import { ordinal } from "./worksheet-style";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

export type BlockerKind = "fictional" | "wow" | "cdcm" | "quotation";

export interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
  blockerKind: BlockerKind | null;
  /** Names the offending CD for the "quotation" blocker, e.g. "1st Chunk, 2nd CD". */
  blockerLabel: string | null;
}

const OK: GateResult = {
  canContinue: true,
  blockerPosition: null,
  blockerKind: null,
  blockerLabel: null,
};

function blocked(
  bp: BodyParagraphData,
  kind: BlockerKind,
  label: string | null = null
): GateResult {
  return {
    canContinue: false,
    blockerPosition: bp.position,
    blockerKind: kind,
    blockerLabel: label,
  };
}

/**
 * First CD in the paragraph that is marked as a quotation but carries no
 * complete pair of quotation marks. Placing the marks is the Embedding
 * Quotations skill (guide pp.77–79) and the app no longer places them for
 * the student, so the gate holds them to it. Position-lenient: a blended
 * quotation (This "woman" with her "crutch") passes — see
 * lib/quotation-marks.ts. Applies to expository, argumentation and
 * literary alike, since all three share CdEditor.
 *
 * An empty CD is skipped: nothing typed yet is not yet a mistake.
 */
function findUnmarkedQuotation(bp: BodyParagraphData): string | null {
  for (const [ci, chunk] of bp.chunks.entries()) {
    for (const [di, cd] of chunk.concrete_details.entries()) {
      const text = cd.text.trim();
      if (!cd.is_quotation || text.length === 0) continue;
      if (!hasQuotationPair(text)) {
        return `${ordinal(ci + 1)} Chunk, ${ordinal(di + 1)} CD`;
      }
    }
  }
  return null;
}

export function computeGate(
  mode: Mode,
  bps: readonly BodyParagraphData[]
): GateResult {
  const isNarrative = mode === "narrative";

  for (const bp of bps) {
    const tc = bp.t_chart;

    // Fictional narratives use the ABC plan, not the WOW fields — gate on
    // ABC content (key word / concrete example / story conflict) instead.
    if (isNarrative && tc?.narrative_kind === "fictional") {
      const hasContent = !!(
        tc.narrative_key_word?.trim() ||
        tc.narrative_concrete_example?.trim() ||
        tc.abc_conflict?.trim()
      );
      if (!hasContent) return blocked(bp, "fictional");
      continue;
    }

    if (isNarrative) {
      const hasContent = !!(
        tc?.narrative_when?.trim() ||
        tc?.narrative_where?.trim() ||
        tc?.narrative_who?.trim() ||
        tc?.narrative_what_happened?.trim()
      );
      if (!hasContent) return blocked(bp, "wow");
      continue;
    }

    const hasCD = bp.chunks.some((c) =>
      c.concrete_details.some((cd) => cd.text.trim().length > 0)
    );
    if (!hasCD) return blocked(bp, "cdcm");

    const unmarked = findUnmarkedQuotation(bp);
    if (unmarked) return blocked(bp, "quotation", unmarked);
  }

  return OK;
}

/** The line under the Continue button: what's ready, or what's missing. */
export function gateMessage(gate: GateResult, bpCount: number): string {
  if (gate.canContinue) {
    return `${bpCount} body paragraph${bpCount === 1 ? "" : "s"} ready`;
  }
  const bp = `Body paragraph ${gate.blockerPosition}`;
  switch (gate.blockerKind) {
    case "fictional":
      return `${bp} needs ABC planning — a key word, concrete example, or story conflict.`;
    case "wow":
      return `${bp} needs at least one WOW detail (when, where, who, or what happened).`;
    case "quotation":
      return `${bp}: ${gate.blockerLabel} is marked as a quotation but has no quotation marks. Add them around the exact words you took from the text.`;
    default:
      return `${bp} needs at least one concrete detail.`;
  }
}
