/**
 * Narrative body-paragraph labels — guide p. 59, "Two Different Layouts".
 *
 *   - A fictional narrative, OR an event in time → Beginning / Middle / End
 *   - A person, place, or thing (PPT)            → 1st / 2nd / 3rd Reason
 *
 * Fictional is ALWAYS Layout 1 (Beginning/Middle/End) — subject is
 * irrelevant for that kind, and it short-circuits ahead of the NULL and
 * body-paragraph-count guards. For every other case the layout depends on
 * narrative_kind + narrative_subject, both NULL until the Discovery step
 * runs; NULL kind/subject or a body-paragraph count other than 3 fall back
 * to the generic "Body Paragraph {position}". Positions past the third
 * also fall through to generic via the array lookup.
 *
 * kind/subject are read per body paragraph (per t_chart row): a writing is
 * normally one layout throughout, but deriving each label from its own BP
 * is more correct than forcing BP1's value onto every paragraph.
 */

import type { Database } from "./database.types";

type NarrativeKind = Database["public"]["Enums"]["jswp_narrative_kind"];
type NarrativeSubject = Database["public"]["Enums"]["jswp_narrative_subject"];

const BEGINNING_MIDDLE_END = ["Beginning", "Middle", "End"] as const;
const REASONS = ["1st Reason", "2nd Reason", "3rd Reason"] as const;

export function narrativeBpLabel(
  kind: NarrativeKind | null,
  subject: NarrativeSubject | null,
  position: number,
  totalBps: number
): string {
  const generic = `Body Paragraph ${position}`;
  const idx = position - 1;

  // Fictional is always Layout 1, regardless of subject or BP count.
  if (kind === "fictional") {
    return BEGINNING_MIDDLE_END[idx] ?? generic;
  }

  if (kind === null || subject === null) return generic;
  if (totalBps !== 3) return generic;

  if (subject === "person" || subject === "place" || subject === "thing") {
    return REASONS[idx] ?? generic;
  }
  if (subject === "event") {
    return BEGINNING_MIDDLE_END[idx] ?? generic;
  }
  return generic;
}
