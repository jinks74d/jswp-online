/**
 * Shared presentational tokens for the worksheet-style Expository T-Chart
 * (design base: T-Chart Worksheet.html). Keeping these in one place so the
 * paper aesthetic stays consistent across expository-t-chart.tsx and
 * expository-chunk-grid.tsx.
 */

/**
 * Ruled "notebook paper" writing surface — a repeating 32px line matched to
 * `leading-8` so typed lines sit on the rules. Applied to bare AutoSaveInput
 * fields (TS/CS/CD lead-in). Colour of the ink is set by the caller.
 */
export const RULED_FIELD =
  "leading-8 text-[15px] bg-[repeating-linear-gradient(to_bottom,transparent_0_31px,#e2e5e9_31px_32px)]";

/** JSWP colour code as raw hex, matching the printed worksheet. */
export const WORKSHEET_INK = {
  cd: "#b91c1c", // red — concrete detail
  cm: "#15803d", // green — commentary
  ts: "#1e40af", // blue — topic / concluding sentence
} as const;

/**
 * The non-colour signal for each role (CLAUDE.md §9): every colour-coded
 * region also carries its shape glyph, so a student who can't distinguish
 * red from green can still tell a CD from a CM.
 *
 * Shapes are the ones Dr. Louis uses on the board — blue five-pointed star
 * for the topic sentence, red rectangle for a concrete detail, green circle
 * for commentary, and the concluding sentence's star with an exclamation
 * point ("end it with a bang"). Rendered aria-hidden alongside the visible
 * role label, which is what a screen reader announces.
 */
export const WORKSHEET_GLYPH = {
  ts: "★",
  cd: "▬",
  cm: "●",
  cs: "★!",
} as const;

const ORDINALS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
] as const;

/** "One Chunk" / "Two Chunks" / … for the worksheet title band. */
export function chunkCountWord(n: number): string {
  const word = n >= 0 && n < ORDINALS.length ? ORDINALS[n] : String(n);
  return `${word} ${n === 1 ? "Chunk" : "Chunks"}`;
}

/** "1st" / "2nd" / "3rd" / "4th" … for CD headings ("1st CHUNK, 2nd CD"). */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
