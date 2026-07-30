/**
 * Final-draft self-check for Literary essays. The guide names literary present
 * tense (p.179) and third-person-only POV (first/second person "unacceptable,"
 * p.2784) as scoring criteria — so this is a NON-BLOCKING self-check, not a
 * grammar linter. The enumerated "no-no words" list is NOT in the guide and is
 * out of scope (CLAUDE.md §15.2).
 */
export const LITERARY_FINAL_SELF_CHECKS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "literary_present_tense", label: "Written in literary present tense (LP)" },
  { key: "third_person", label: "Third person only (no I / you / we)" },
];

const FIRST_SECOND_PERSON =
  /\b(I|me|my|mine|we|us|our|ours|you|your|yours)\b/gi;

/** High-confidence nudge: whole-word first/second-person pronouns in the draft. */
export function findFirstSecondPersonPronouns(text: string): string[] {
  const matches = text.match(FIRST_SECOND_PERSON);
  return matches ? Array.from(matches) : [];
}
