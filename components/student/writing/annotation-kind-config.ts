/**
 * Single source of truth for annotation-kind presentation. The four
 * variants of jswp_annotation_kind map here. Whenever the UI shows
 * a kind (highlight color, badge, dropdown option), it pulls from
 * this config so the visual language stays consistent.
 *
 * CD/CM are anchored to the JSWP color canon (red/green per CLAUDE.md
 * §4 and the schema comment at migrations/0001:299-300). Transition
 * uses sky to avoid colliding with reserved JSWP-blue (TS/CS).
 * Note uses gray as a neutral side-comment color.
 */

import type { Database } from "@/lib/database.types";

export type AnnotationKind = Database["public"]["Enums"]["jswp_annotation_kind"];

export interface AnnotationKindConfig {
  readonly key: AnnotationKind;
  readonly label: string;
  readonly description: string;
  /** Highlight background applied to the rendered <mark> element. */
  readonly highlightBg: string;
  /** Accent text color used in badges, dropdowns, and sidebar headers. */
  readonly accentText: string;
  /** Solid color dot used in badges/legend. */
  readonly dotBg: string;
}

export const ANNOTATION_KINDS: Record<AnnotationKind, AnnotationKindConfig> = {
  cd: {
    key: "cd",
    label: "Concrete Detail",
    description: "A fact, example, or piece of evidence from the text.",
    highlightBg: "bg-red-100",
    accentText: "text-red-700",
    dotBg: "bg-red-500",
  },
  cm: {
    key: "cm",
    label: "Commentary",
    description: "Your analysis, reaction, or interpretation.",
    highlightBg: "bg-green-100",
    accentText: "text-green-700",
    dotBg: "bg-green-500",
  },
  transition: {
    key: "transition",
    label: "Transition",
    description: "A transition word or phrase that signals movement of ideas.",
    highlightBg: "bg-sky-100",
    accentText: "text-sky-700",
    dotBg: "bg-sky-500",
  },
  note: {
    key: "note",
    label: "Note",
    description: "A general margin note about the passage.",
    highlightBg: "bg-gray-200",
    accentText: "text-gray-700",
    dotBg: "bg-gray-500",
  },
};

export const ANNOTATION_KIND_ORDER: readonly AnnotationKind[] = [
  "cd",
  "cm",
  "transition",
  "note",
];
