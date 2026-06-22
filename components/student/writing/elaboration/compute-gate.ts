import type { CommentaryBpData } from "@/lib/queries/commentary";

interface GateResult {
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
