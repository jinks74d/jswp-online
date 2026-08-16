import type { CommentaryBpData } from "@/lib/queries/commentary";

export interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

export function computeGate(bps: readonly CommentaryBpData[]): GateResult {
  for (const bp of bps) {
    for (const chunk of bp.chunks) {
      for (const cd of chunk.cds) {
        const bestWords = cd.words.filter((w) => w.is_best_word_for_chunk);
        for (const word of bestWords) {
          const phraseCount = cd.phrases.filter(
            (p) => p.parent_cm_id === word.id && p.text.trim().length > 0
          ).length;
          if (phraseCount < 2) {
            return { canContinue: false, blockerPosition: bp.position };
          }
        }
      }
    }
  }
  return { canContinue: true, blockerPosition: null };
}

/**
 * The student-facing sentence for a gate result.
 *
 * Lives beside the rule rather than in StepShell: the shell takes an opaque
 * string precisely so each step keeps its own wording. Mirrors
 * t-chart/compute-gate.ts.
 */
export function gateMessage(gate: GateResult): string {
  return gate.canContinue
    ? "Each best word has at least two elaboration phrases."
    : `Body paragraph ${gate.blockerPosition} needs two phrases for each best word.`;
}
