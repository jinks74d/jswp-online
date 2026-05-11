/**
 * Shared exemplar constants (chunks 6.1, 6.5).
 *
 * Lives outside the "use server" boundary so both server actions and
 * the client form / list page can import.
 */

export const EXEMPLAR_TEXT_MAX = 20_000;

/**
 * Tag-relevant subset of GroupOrigin (lib/jswp-modes.ts). Curated to
 * the pedagogically modelable steps — what teachers would naturally
 * say "here's a good example of X." Excluded values are process /
 * scaffolding steps that don't have a meaningful "what good looks
 * like" model (decode_prompt, annotate_text, gathering_cds,
 * literary_decisions, narrative_discovery).
 *
 * Edit this list to add or remove options. Existing exemplars
 * carrying a removed tag silently lose visibility on the filter
 * chip + the matched-step student panel, but their data is
 * preserved.
 */
export const STEP_TAG_VALUES = [
  "thesis",
  "topic_sentence_dev",
  "t_chart",
  "shaping_sheet",
  "paragraph_form",
  "introduction",
  "conclusion",
  "final_draft",
  "literary_cm_dev",
  "literary_elaboration",
] as const;

export type StepTag = (typeof STEP_TAG_VALUES)[number];

export const STEP_TAG_LABELS: Record<StepTag, string> = {
  thesis: "Thesis",
  topic_sentence_dev: "Topic Sentence",
  t_chart: "T-chart",
  shaping_sheet: "Shaping Sheet",
  paragraph_form: "Paragraph Form",
  introduction: "Introduction",
  conclusion: "Conclusion",
  final_draft: "Final Draft",
  literary_cm_dev: "Literary CM Dev",
  literary_elaboration: "Elaboration",
};

const STEP_TAG_SET = new Set<string>(STEP_TAG_VALUES);

export function isStepTag(value: unknown): value is StepTag {
  return typeof value === "string" && STEP_TAG_SET.has(value);
}

export type StepTagValidation =
  | { ok: true; tags: StepTag[] }
  | { ok: false; error: string };

/**
 * Validates an unknown value as a list of step tags. Used by the
 * server actions. Duplicate values are deduplicated. Empty input
 * (no values, empty string entries) returns `{ ok: true, tags: [] }`
 * — the action then normalizes to NULL before writing.
 */
export function validateStepTags(value: unknown): StepTagValidation {
  if (value === null || value === undefined) {
    return { ok: true, tags: [] };
  }
  const list = Array.isArray(value) ? value : [value];
  const seen = new Set<StepTag>();
  for (const v of list) {
    if (typeof v !== "string" || v === "") continue;
    if (!isStepTag(v)) {
      return { ok: false, error: `Unknown step tag: ${v}` };
    }
    seen.add(v);
  }
  return { ok: true, tags: Array.from(seen) };
}
