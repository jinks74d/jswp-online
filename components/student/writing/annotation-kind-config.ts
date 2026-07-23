/**
 * Single source of truth for annotation-kind presentation. The four
 * variants of jswp_annotation_kind map here. Whenever the UI shows
 * a kind (highlight color, badge, dropdown option), it pulls from
 * this config so the visual language stays consistent.
 *
 * CD/CM are anchored to the JSWP color canon (red/green per CLAUDE.md
 * §4 and the schema comment at migrations/0001:299-300). Transition
 * uses sky to avoid colliding with reserved JSWP-blue (TS/CS).
 * Note uses gray as a neutral side-comment color. Main Idea uses a
 * dark underline (not a fill) to echo the guide's "underline the main
 * idea in black" convention (Finding the Main Idea, 2024 guide pp.52-53);
 * highlightBg holds underline utilities rather than a background here.
 *
 * Accessibility (WCAG 1.4.1 Use of Color, CLAUDE.md §9): kind must not be
 * conveyed by highlight color alone. Each kind therefore also carries a
 * distinct underline *line style* — solid (main idea), dotted (CD), dashed
 * (CM), wavy (transition), double (note) — so the five kinds are
 * distinguishable without perceiving color.
 */

import type { Database } from "@/lib/database.types";

export type AnnotationKind = Database["public"]["Enums"]["jswp_annotation_kind"];

export interface AnnotationKindConfig {
  readonly key: AnnotationKind;
  readonly label: string;
  /**
   * Optional longer label for the annotation sidebar's grouped entries, where
   * there is room to name what the entry actually holds. Falls back to
   * `label`. Split into parts so each word can carry its JSWP canon color
   * (CLAUDE.md §4) — red for CD, green for CM, black for connectives. Kept
   * here rather than hardcoded in the sidebar so kind presentation stays in
   * one file (see the module note above).
   *
   * Color is reinforcement only: the words themselves carry the meaning, so
   * nothing is conveyed by color alone (WCAG 1.4.1).
   */
  readonly sidebarLabelParts?: readonly {
    readonly text: string;
    readonly className: string;
  }[];
  readonly description: string;
  /** Highlight background applied to the rendered <mark> element. */
  readonly highlightBg: string;
  /** Accent text color used in badges, dropdowns, and sidebar headers. */
  readonly accentText: string;
  /** Solid color dot used in badges/legend. */
  readonly dotBg: string;
}

export const ANNOTATION_KINDS: Record<AnnotationKind, AnnotationKindConfig> = {
  main_idea: {
    key: "main_idea",
    label: "Main Idea",
    description: "The source's main idea or thesis — underline it first.",
    // Dark underline, no fill — echoes "underline the main idea in black."
    highlightBg:
      "bg-gray-100 underline decoration-2 decoration-gray-800 underline-offset-2",
    accentText: "text-gray-900",
    dotBg: "bg-gray-900",
  },
  cd: {
    key: "cd",
    label: "Concrete Detail",
    // Every CD annotation now carries required commentary, so the sidebar's
    // grouped entries name both halves — each in its canon color.
    sidebarLabelParts: [
      { text: "Concrete Detail", className: "text-red-700" },
      { text: " & ", className: "text-gray-900" },
      { text: "Commentary", className: "text-green-700" },
    ],
    description: "A fact, example, or piece of evidence from the text.",
    // Dotted underline — the non-color cue distinguishing CD from CM etc.
    highlightBg:
      "bg-red-100 underline decoration-dotted decoration-2 decoration-red-700 underline-offset-2",
    accentText: "text-red-700",
    dotBg: "bg-red-500",
  },
  cm: {
    key: "cm",
    label: "Commentary",
    description: "Your analysis, reaction, or interpretation.",
    // Dashed underline — non-color cue.
    highlightBg:
      "bg-green-100 underline decoration-dashed decoration-2 decoration-green-700 underline-offset-2",
    accentText: "text-green-700",
    dotBg: "bg-green-500",
  },
  transition: {
    key: "transition",
    label: "Transition",
    description: "A transition word or phrase that signals movement of ideas.",
    // Wavy underline — non-color cue.
    highlightBg:
      "bg-sky-100 underline decoration-wavy decoration-sky-700 underline-offset-2",
    accentText: "text-sky-700",
    dotBg: "bg-sky-500",
  },
  note: {
    key: "note",
    label: "Note",
    description: "A general margin note about the passage.",
    // Double underline — non-color cue.
    highlightBg:
      "bg-gray-200 underline decoration-double decoration-gray-600 underline-offset-2",
    accentText: "text-gray-700",
    dotBg: "bg-gray-500",
  },
};

export const ANNOTATION_KIND_ORDER: readonly AnnotationKind[] = [
  "main_idea",
  "cd",
  "cm",
  "transition",
  "note",
];
