/**
 * JSWP Mode and Step Configuration
 * ─────────────────────────────────────────────────────────────────────────
 * Source of truth for the step sequence each writing mode walks a student
 * through. The UI's step engine reads from here; the database stores only
 * step KEYS (in `step_progress.step_key` and `student_writings.current_step`).
 *
 * To add a new mode (e.g. 'style_analysis'), add a config entry below.
 * No schema migration needed.
 *
 * Step path mirrors the Jane Schaffer Academic Writing Program guides:
 *   * 2024 Expository/Informational Guide — pp. 36-72, 152-156
 *   * 2019 Argumentation Guide — pp. 22-72, 158-167
 *   * 2018 Personal & Fictional Narrative Guide — pp. 26-110
 *   * Response to Literature Quick Start Guides (RLv4, RL Annabel Lee,
 *     RL "To Sleep Under the Stars")
 */

import type { Database } from "./database.types";

/* ─── Type aliases pulled from database ──────────────────────────────── */

export type JswpMode = Database["public"]["Enums"]["jswp_mode"];
export type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

/* ─── Step configuration ─────────────────────────────────────────────── */

/**
 * A single step in a mode's flow.
 *   * `key`    — globally unique, dotted to scope by mode (e.g. 'expository.gather_cds').
 *               Stored in DB; referenced by URL; never displayed to students.
 *   * `slug`   — URL segment ('gather-cds').
 *   * `label`  — displayed to students/teachers ('Gathering CDs').
 *   * `subLabel` — secondary detail ('Step 3 of 6').
 *   * `groupOrigin` — which paper-guide artifact this screen represents.
 *               Helps the UI mirror what students see in the printed guide.
 *   * `pedagogyHint` — short guidance text shown at top of the screen
 *               (drawn from the guide's "I Do It / We Do It" framing).
 *   * `required` — must be completed before the writing can be submitted.
 *   * `repeatPerBP` — true when the step has one instance per body paragraph
 *               (T-Chart, Shaping Sheet, Paragraph Form, etc).
 *   * `essayOnly`  — only shown when assignments.is_essay = true.
 *   * `requiresCounterargument` — only shown when assignments.has_counterargument = true.
 *   * `requiresSourceText` — only shown when an assignment provides source_text.
 */
export interface StepConfig {
  readonly key: string;
  readonly slug: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly groupOrigin: GroupOrigin;
  readonly pedagogyHint?: string;
  readonly required: boolean;
  readonly repeatPerBP: boolean;
  readonly essayOnly?: boolean;
  readonly requiresCounterargument?: boolean;
  readonly requiresSourceText?: boolean;
}

export type GroupOrigin =
  | "decode_prompt"
  | "annotate_text"
  | "gathering_cds"
  | "topic_sentence_dev"
  | "literary_cm_dev"
  | "literary_decisions"
  | "literary_elaboration"
  | "narrative_discovery"
  | "t_chart"
  | "shaping_sheet"
  | "thesis"
  | "introduction"
  | "conclusion"
  | "paragraph_form"
  | "final_draft";

/**
 * A mode's full configuration.
 */
export interface ModeConfig {
  readonly mode: JswpMode;
  readonly displayName: string;
  readonly defaultChunkRatio: ChunkRatio;
  readonly description: string;
  readonly icon: ModeIcon;
  readonly steps: readonly StepConfig[];
}

export type ModeIcon = "owl" | "scales" | "book" | "moon";

/* ─── Expository / Informational ─────────────────────────────────────── */

const EXPOSITORY_STEPS: readonly StepConfig[] = [
  {
    key: "expository.decode_prompt",
    slug: "decode-prompt",
    label: "Decoding the Prompt",
    subLabel: "Step 1",
    groupOrigin: "decode_prompt",
    pedagogyHint:
      "Before you write, identify what the prompt is asking. Look for the form (paragraph, short answer, essay), the ratio, and the key verbs.",
    required: true,
    repeatPerBP: false,
  },
  {
    key: "expository.annotate_text",
    slug: "annotate-text",
    label: "Reading & Annotating the Text",
    subLabel: "Step 2",
    groupOrigin: "annotate_text",
    pedagogyHint:
      "Read carefully. Underline concrete details in red. Underline commentary in green. Notes in the margin help you find evidence later.",
    required: true,
    repeatPerBP: false,
    requiresSourceText: true,
  },
  {
    key: "expository.gather_cds",
    slug: "gather-cds",
    label: "Gathering & Prioritizing CDs",
    subLabel: "Step 3",
    groupOrigin: "gathering_cds",
    pedagogyHint:
      "List 4 or more concrete details that fit the prompt. Highlight the 2 or more you want to use. Drag them into the order you want them to appear.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "expository.t_chart",
    slug: "t-chart",
    label: "Completing the T-Chart",
    subLabel: "Step 4",
    groupOrigin: "t_chart",
    pedagogyHint:
      "Write your topic sentence at the top. Place CDs on the left and brainstorm 'Why is this important?' commentary on the right. Revise your TS and write your concluding sentence.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "expository.shaping_sheet",
    slug: "shaping-sheet",
    label: "Editing & Revising on the Shaping Sheet",
    subLabel: "Step 5",
    groupOrigin: "shaping_sheet",
    pedagogyHint:
      "Move and improve your sentences. Apply Dr. Louis's grammar rules. 'Once you use a word, you lose it' — don't repeat phrases between sentences.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "expository.thesis",
    slug: "thesis",
    label: "Thesis Statement",
    groupOrigin: "thesis",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "expository.introduction",
    slug: "introduction",
    label: "Introduction",
    groupOrigin: "introduction",
    pedagogyHint:
      "Begin broadly. Narrow to your thesis. The introduction is all commentary — written in black for an essay.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "expository.conclusion",
    slug: "conclusion",
    label: "Conclusion",
    groupOrigin: "conclusion",
    pedagogyHint:
      "Restate (don't repeat) the thesis. Broaden out. Provide a finished feeling.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "expository.paragraph_form",
    slug: "paragraph-form",
    label: "Paragraph Form",
    subLabel: "Final Step",
    groupOrigin: "paragraph_form",
    pedagogyHint:
      "Assemble the paragraph in color: blue for TS and CS, red for CDs, green for CMs. Black if writing the final clean copy.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "expository.final_draft",
    slug: "final-draft",
    label: "Final Draft",
    groupOrigin: "final_draft",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
];

/* ─── Argumentation ──────────────────────────────────────────────────── */

const ARGUMENTATION_STEPS: readonly StepConfig[] = [
  {
    key: "argumentation.decode_prompt",
    slug: "decode-prompt",
    label: "Decoding the Prompt",
    subLabel: "Step 1",
    groupOrigin: "decode_prompt",
    pedagogyHint:
      "Identify what the prompt asks you to argue. Note the form, the ratio, and which side(s) you'll need to consider.",
    required: true,
    repeatPerBP: false,
  },
  {
    key: "argumentation.annotate_text",
    slug: "annotate-text",
    label: "Reading & Annotating the Text",
    subLabel: "Step 2",
    groupOrigin: "annotate_text",
    pedagogyHint:
      "Annotate sources for evidence. CDs in red. Commentary in green. Note quotations you may want to embed.",
    required: false,
    repeatPerBP: false,
    requiresSourceText: true,
  },
  {
    key: "argumentation.gather_cds",
    slug: "gather-cds",
    label: "Gathering CDs",
    subLabel: "Step 3",
    groupOrigin: "gathering_cds",
    pedagogyHint:
      "Brainstorm 4 or more CDs that could support an argument. Some will be Pro, some Con — you'll sort them next.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "argumentation.topic_sentence_dev",
    slug: "topic-sentence-development",
    label: "Topic Sentence Development",
    subLabel: "Step 4",
    groupOrigin: "topic_sentence_dev",
    pedagogyHint:
      "Mark each CD as For (Pro) or Against (Con). The side with more CDs becomes your topic sentence direction.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "argumentation.t_chart",
    slug: "t-chart",
    label: "Completing the T-Chart",
    subLabel: "Step 5",
    groupOrigin: "t_chart",
    pedagogyHint:
      "Place CDs on the left. Brainstorm 'why is this important?' commentary on the right. Embed quotations carefully — every quote needs a transitional lead-in.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "argumentation.counterargument",
    slug: "counterargument",
    label: "Concession, Counterargument, Refutation",
    groupOrigin: "t_chart",
    pedagogyHint:
      "Concede a point. Then state the counterargument. Then refute it logically — show why your position is stronger.",
    required: true,
    repeatPerBP: true,
    requiresCounterargument: true,
  },
  {
    key: "argumentation.shaping_sheet",
    slug: "shaping-sheet",
    label: "Editing & Revising on the Shaping Sheet",
    subLabel: "Step 6",
    groupOrigin: "shaping_sheet",
    pedagogyHint:
      "Move and improve. Apply grammar rules. Pick-n-stitch the strongest CMs into your sentences.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "argumentation.thesis",
    slug: "thesis",
    label: "Thesis Statement",
    groupOrigin: "thesis",
    pedagogyHint:
      "Try a framed thesis: 'Although X, Y; however, Z.' Or a three-pronged: 'A, B, and C.'",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "argumentation.introduction",
    slug: "introduction",
    label: "Introduction",
    groupOrigin: "introduction",
    pedagogyHint:
      "Give a historical overview ('In the past...', 'Over the years...'). End with the thesis.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "argumentation.conclusion",
    slug: "conclusion",
    label: "Conclusion",
    groupOrigin: "conclusion",
    pedagogyHint:
      "Convince your reader. Call for action, attitude, or belief. End with 'In the final analysis...' or similar.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "argumentation.paragraph_form",
    slug: "paragraph-form",
    label: "Paragraph Form",
    subLabel: "Final Step",
    groupOrigin: "paragraph_form",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "argumentation.final_draft",
    slug: "final-draft",
    label: "Final Draft with Title",
    groupOrigin: "final_draft",
    pedagogyHint:
      "Now give a creative title. Is there a word or phrase from your paragraph that could become the title?",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
];

/* ─── Literary / Response to Literature ──────────────────────────────── */

const LITERARY_STEPS: readonly StepConfig[] = [
  {
    key: "literary.decode_prompt",
    slug: "decode-prompt",
    label: "Decoding the Prompt",
    subLabel: "Step 1",
    groupOrigin: "decode_prompt",
    pedagogyHint:
      "Identify what literary element the prompt is asking about — character, conflict, figurative language, theme. The ratio will be 1:2+.",
    required: true,
    repeatPerBP: false,
  },
  {
    key: "literary.annotate_text",
    slug: "annotate-text",
    label: "Close Reading & Annotation",
    subLabel: "Step 2",
    groupOrigin: "annotate_text",
    pedagogyHint:
      "Read closely. Underline plot details (CD) in red. Underline reactions/inferences (CM) in green. Note speaker, imagery, tone.",
    required: true,
    repeatPerBP: false,
    requiresSourceText: true,
  },
  {
    key: "literary.gather_cds",
    slug: "gather-cds",
    label: "Gathering CDs",
    subLabel: "Step 3",
    groupOrigin: "gathering_cds",
    pedagogyHint:
      "List 3-5 concrete details from the text. For literary, you'll combine them into ONE sentence per chunk (1:2+). Drag to reorder.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.cm_dev",
    slug: "generate-commentary",
    label: "Generating Commentary",
    subLabel: "Step 4",
    groupOrigin: "literary_cm_dev",
    pedagogyHint:
      "Brainstorm 5 single words for each CD. These should describe tone, mood, character — not full sentences. Words come first; sentences come later.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.decisions",
    slug: "making-decisions",
    label: "Making Decisions",
    subLabel: "Step 5",
    groupOrigin: "literary_decisions",
    pedagogyHint:
      "Pick the BEST single word for your topic sentence — one that captures the whole paragraph. Then pick 2 best words per chunk.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.elaboration",
    slug: "elaboration",
    label: "Elaboration",
    subLabel: "Step 6",
    groupOrigin: "literary_elaboration",
    pedagogyHint:
      "For each CM word, write a synonym, then two phrases of 3+ words that explain what you mean. These 'cloud' phrases will become your CM sentences.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.t_chart",
    slug: "t-chart",
    label: "Completing the T-Chart",
    subLabel: "Step 7",
    groupOrigin: "t_chart",
    pedagogyHint:
      "Working topic sentence at top. CD on the left (one combined sentence). 2+ CM sentences on the right. Concluding sentence is all commentary.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.shaping_sheet",
    slug: "shaping-sheet",
    label: "Shaping Sheet",
    subLabel: "Step 8",
    groupOrigin: "shaping_sheet",
    pedagogyHint:
      "Introduce the title and author. Embed quotations with citations. Pick-n-stitch your cloud phrases into CM sentences. Don't repeat phrasing across CMs.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.thesis",
    slug: "thesis",
    label: "Thesis Statement",
    groupOrigin: "thesis",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "literary.introduction",
    slug: "introduction",
    label: "Introduction",
    groupOrigin: "introduction",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "literary.conclusion",
    slug: "conclusion",
    label: "Conclusion",
    groupOrigin: "conclusion",
    pedagogyHint:
      "All commentary, no concrete detail. Don't repeat key words from earlier. Provide a finished feeling.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "literary.paragraph_form",
    slug: "paragraph-form",
    label: "Paragraph Form",
    subLabel: "Final Step",
    groupOrigin: "paragraph_form",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "literary.final_draft",
    slug: "final-draft",
    label: "Final Draft",
    groupOrigin: "final_draft",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
];

/* ─── Narrative ─────────────────────────────────────────────────────── */

const NARRATIVE_STEPS: readonly StepConfig[] = [
  {
    key: "narrative.decode_prompt",
    slug: "decode-prompt",
    label: "Decoding the Prompt",
    subLabel: "Step 1",
    groupOrigin: "decode_prompt",
    required: true,
    repeatPerBP: false,
  },
  {
    key: "narrative.discovery",
    slug: "discovery",
    label: "Discovering the Topic",
    subLabel: "Step 2",
    groupOrigin: "narrative_discovery",
    pedagogyHint:
      "List ideas pertaining to your topic. Consider family, friends, school, work, play. When and where do these things happen? Pick the concrete example you know best.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "narrative.topic_sentences",
    slug: "topic-sentences",
    label: "Topic Sentences",
    subLabel: "Step 3",
    groupOrigin: "topic_sentence_dev",
    pedagogyHint:
      "Each body paragraph needs a topic sentence — a feeling or insight that reflects on the moment you'll narrate.",
    required: true,
    repeatPerBP: false,
  },
  {
    key: "narrative.t_chart",
    slug: "t-chart",
    label: "T-Chart with WOW Brainstorm",
    subLabel: "Step 4",
    groupOrigin: "t_chart",
    pedagogyHint:
      "Web off the When, Where, Who, What Happened, Dialogue. Capture how you felt and what you were thinking. Concrete details on the left, feelings on the right.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "narrative.shaping_sheet",
    slug: "shaping-sheet",
    label: "Shaping Sheet",
    subLabel: "Step 5",
    groupOrigin: "shaping_sheet",
    pedagogyHint:
      "Move and improve. Vary sentence openings. Use transitions to show changes in time, place, character, or action.",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "narrative.introduction",
    slug: "introduction",
    label: "Introduction",
    groupOrigin: "introduction",
    pedagogyHint:
      "Hook your reader: with an anecdote, the climax, a rhetorical question, a startling fact, dialogue, a quotation, or internal monologue.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "narrative.conclusion",
    slug: "conclusion",
    label: "Conclusion",
    groupOrigin: "conclusion",
    pedagogyHint:
      "End with the lesson learned, a feeling, a prediction, a summary statement, or a quotation. Don't restate the introduction.",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
  {
    key: "narrative.paragraph_form",
    slug: "paragraph-form",
    label: "Paragraph Form",
    subLabel: "Final Step",
    groupOrigin: "paragraph_form",
    required: true,
    repeatPerBP: true,
  },
  {
    key: "narrative.final_draft",
    slug: "final-draft",
    label: "Final Draft",
    groupOrigin: "final_draft",
    required: true,
    repeatPerBP: false,
    essayOnly: true,
  },
];

/* ─── Mode registry ──────────────────────────────────────────────────── */

export const MODES: Record<JswpMode, ModeConfig> = {
  expository: {
    mode: "expository",
    displayName: "Expository / Informational",
    defaultChunkRatio: "two_plus_to_one",
    description:
      "Explains, informs, or summarizes. Across-the-curriculum: science, social studies, math, business.",
    icon: "owl",
    steps: EXPOSITORY_STEPS,
  },
  argumentation: {
    mode: "argumentation",
    displayName: "Argumentation",
    defaultChunkRatio: "two_plus_to_one",
    description:
      "Argues for or against a position. May include concession, counterargument, and refutation.",
    icon: "scales",
    steps: ARGUMENTATION_STEPS,
  },
  literary: {
    mode: "literary",
    displayName: "Response to Literature",
    defaultChunkRatio: "one_to_two_plus",
    description:
      "Analyzes a literary work — character, theme, figurative language, style. Ratio is 1:2+.",
    icon: "book",
    steps: LITERARY_STEPS,
  },
  narrative: {
    mode: "narrative",
    displayName: "Narrative",
    defaultChunkRatio: "two_plus_to_one",
    description:
      "Tells a personal or fictional story. Has a clear beginning, middle, end, with a feeling or insight.",
    icon: "moon",
    steps: NARRATIVE_STEPS,
  },
};

/* ─── Step engine helpers ────────────────────────────────────────────── */

export interface StepResolutionContext {
  isEssay: boolean;
  hasCounterargument: boolean;
  hasSourceText: boolean;
}

/**
 * Returns the visible, ordered steps for a given mode and assignment context.
 * Steps marked essayOnly / requiresCounterargument / requiresSourceText
 * are filtered out when their flag is false.
 */
export function getSteps(
  mode: JswpMode,
  ctx: StepResolutionContext
): readonly StepConfig[] {
  return MODES[mode].steps.filter((step) => {
    if (step.essayOnly && !ctx.isEssay) return false;
    if (step.requiresCounterargument && !ctx.hasCounterargument) return false;
    if (step.requiresSourceText && !ctx.hasSourceText) return false;
    return true;
  });
}

/**
 * Find a step by its full key (e.g. 'expository.gather_cds').
 */
export function getStepByKey(key: string): StepConfig | undefined {
  for (const cfg of Object.values(MODES)) {
    const found = cfg.steps.find((s) => s.key === key);
    if (found) return found;
  }
  return undefined;
}

/**
 * Find a step by mode and slug (used for URL routing: /writings/[id]/[slug]).
 */
export function getStepBySlug(
  mode: JswpMode,
  slug: string
): StepConfig | undefined {
  return MODES[mode].steps.find((s) => s.slug === slug);
}

/**
 * Given a current step and the visible step list, return the next step
 * (or null if at the end). Used for "Save and Next" buttons.
 */
export function getNextStep(
  currentKey: string,
  visibleSteps: readonly StepConfig[]
): StepConfig | null {
  const idx = visibleSteps.findIndex((s) => s.key === currentKey);
  if (idx < 0 || idx === visibleSteps.length - 1) return null;
  return visibleSteps[idx + 1];
}

export function getPreviousStep(
  currentKey: string,
  visibleSteps: readonly StepConfig[]
): StepConfig | null {
  const idx = visibleSteps.findIndex((s) => s.key === currentKey);
  if (idx <= 0) return null;
  return visibleSteps[idx - 1];
}

/**
 * Compute completion percentage given completed step keys.
 * Used for student progress bars and teacher dashboards.
 */
export function computeProgress(
  visibleSteps: readonly StepConfig[],
  completedKeys: readonly string[]
): number {
  const required = visibleSteps.filter((s) => s.required);
  if (required.length === 0) return 100;
  const completed = required.filter((s) => completedKeys.includes(s.key));
  return Math.round((completed.length / required.length) * 100);
}

/* ─── Color tokens ──────────────────────────────────────────────────── */

/**
 * The Jane Schaffer color code is non-negotiable in the method. These
 * tokens map to Tailwind CSS variables defined in app/globals.css.
 *
 * Accessibility: CSS classes also include alternate symbol/pattern
 * variants (●▲■◆) so color-vision-impaired students can distinguish
 * each part without relying on color alone.
 */
export const JSWP_COLORS = {
  TS: "var(--jswp-blue)",       // Topic Sentence
  CS: "var(--jswp-blue)",       // Concluding Sentence
  CD: "var(--jswp-red)",        // Concrete Detail
  CM: "var(--jswp-green)",      // Commentary
  ESSAY: "var(--jswp-black)",   // Intro / conclusion of an essay
  THESIS: "var(--jswp-yellow)", // Thesis (highlighter convention)
  C: "var(--jswp-purple)",      // Concession (argumentation)
  CA: "var(--jswp-orange)",     // Counterargument
  R: "var(--jswp-teal)",        // Refutation
} as const;
