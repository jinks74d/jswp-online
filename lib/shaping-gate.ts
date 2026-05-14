/**
 * Shaping-sheet Continue-gate logic. Pure — no DB, no React, no
 * server-only imports — so it can be unit-tested and shared by the
 * client orchestrator (components/student/writing/shaping/shaping-client).
 *
 * Gate rules (mode-aware):
 *   - All modes: each BP needs a non-empty final TS or final CS
 *     (ideally both; gate on either to stay soft).
 *   - CD/CM modes: each chunk needs ≥1 non-empty CD sentence. Chunks
 *     at a non-summary ratio (2+:1, 1:2+) also need ≥1 non-empty CM
 *     sentence; 3+:0 (summary) chunks have no commentary, so the CM
 *     requirement is skipped per chunk.
 *   - Narrative: TS/CS gate only; no chunk checks.
 *
 * Tooltip text in the client names the offending BP via `reason`.
 */

import type { JswpMode } from "@/lib/jswp-modes";
import type { ShapingBpData } from "@/lib/queries/shaping";

export interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
  reason: string | null;
}

export function computeGate(
  mode: JswpMode,
  bps: readonly ShapingBpData[]
): GateResult {
  const isNarrative = mode === "narrative";
  for (const bp of bps) {
    const ss = bp.shaping_sheet;
    const hasTs = !!ss?.final_topic_sentence?.trim();
    const hasCs = !!ss?.final_concluding_sentence?.trim();
    if (!hasTs && !hasCs) {
      return {
        canContinue: false,
        blockerPosition: bp.position,
        reason: "needs a final TS or CS",
      };
    }

    if (!isNarrative) {
      // Each chunk needs ≥1 non-empty CD sentence. Non-summary ratios
      // (2+:1, 1:2+) also need ≥1 non-empty CM sentence; 3+:0 (summary)
      // has no commentary, so the CM requirement is skipped per chunk.
      for (const chunk of bp.chunks) {
        const out = chunk.output;
        const isSummaryRatio = chunk.ratio === "three_plus_to_zero";
        const cdCount =
          out?.cd_sentences.filter((s) => s.trim().length > 0).length ?? 0;
        const cmCount =
          out?.cm_sentences.filter((s) => s.trim().length > 0).length ?? 0;
        if (cdCount === 0) {
          return {
            canContinue: false,
            blockerPosition: bp.position,
            reason: `chunk ${chunk.position} needs at least one CD sentence`,
          };
        }
        if (!isSummaryRatio && cmCount === 0) {
          return {
            canContinue: false,
            blockerPosition: bp.position,
            reason: `chunk ${chunk.position} needs at least one CM sentence`,
          };
        }
      }
    }
  }
  return { canContinue: true, blockerPosition: null, reason: null };
}
