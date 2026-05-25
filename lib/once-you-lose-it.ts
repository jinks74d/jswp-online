/**
 * "Once you use it, you lose it" — the Shaping Sheet pick-n-stitch rule
 * (CLAUDE.md §4, §18; chunk 4.5d-3). A content word woven into one
 * sentence shouldn't be reused in another sentence of the same chunk.
 *
 * This is a non-blocking *warning* helper: it finds content words that
 * appear in two or more distinct sentences. It never gates Continue —
 * the UI surfaces it as a gentle nudge, since some repetition (proper
 * nouns, key terms) is legitimate and the student is the final judge.
 *
 * Pure + dependency-free so it unit-tests in isolation
 * (__tests__/lib/once-you-lose-it.test.ts).
 */

/** Common function words that don't count as "used" content words. */
const STOPWORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "nor", "for", "so", "yet",
  "of", "to", "in", "on", "at", "by", "as", "is", "are", "was", "were",
  "be", "been", "being", "am", "it", "its", "this", "that", "these",
  "those", "they", "them", "their", "there", "here", "then", "than",
  "with", "from", "into", "onto", "out", "up", "down", "off", "over",
  "i", "you", "he", "she", "we", "his", "her", "him", "our", "your",
  "my", "me", "us", "do", "does", "did", "has", "have", "had", "will",
  "would", "can", "could", "should", "may", "might", "must", "shall",
  "not", "no", "if", "when", "while", "which", "who", "whom", "whose",
  "what", "how", "why", "where", "because", "about", "also", "both",
  "all", "any", "some", "more", "most", "such", "very", "just", "only",
]);

/** Words shorter than this are ignored even if not stopwords. */
const MIN_WORD_LENGTH = 3;

export interface RepeatedWord {
  /** The lowercased content word. */
  readonly word: string;
  /** How many distinct sentences it appears in (always ≥ 2). */
  readonly sentenceCount: number;
}

/** Tokenize to lowercase content words, dropping stopwords + short tokens. */
function contentWords(sentence: string): Set<string> {
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, "")) // trim edge hyphens/apostrophes
    .filter(
      (w) => w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w)
    );
  return new Set(words);
}

/**
 * Find content words shared by two or more of the given sentences.
 * Empty/blank sentences are ignored. Returned words are sorted by
 * descending sentence-count, then alphabetically for stable output.
 */
export function findRepeatedContentWords(
  sentences: readonly string[]
): RepeatedWord[] {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (sentence.trim().length === 0) continue;
    for (const word of contentWords(sentence)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const repeated: RepeatedWord[] = [];
  for (const [word, sentenceCount] of counts) {
    if (sentenceCount >= 2) repeated.push({ word, sentenceCount });
  }
  repeated.sort(
    (a, b) =>
      b.sentenceCount - a.sentenceCount || a.word.localeCompare(b.word)
  );
  return repeated;
}
