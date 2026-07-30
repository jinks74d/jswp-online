"use client";

/**
 * Four cards, one per writing mode. Descriptions come from
 * lib/jswp-modes.ts (single source of truth). Clicking a card pushes
 * a query param, the parent page sees ?mode=… and renders the form.
 */

import Image from "next/image";
import Link from "next/link";
import { MODES, type JswpMode } from "@/lib/jswp-modes";

const ICONS: Record<JswpMode, string> = {
  expository: "/icons/expository01.png",
  argumentation: "/icons/argumentation01.png",
  literary: "/icons/literary01.png",
  narrative: "/icons/narrative01.png",
};

/**
 * Card display order (not data order — MODES stays authoritative for the
 * step engine). In the 2-col grid this maps to quadrants:
 * [0] upper-left, [1] upper-right, [2] lower-left, [3] lower-right.
 * Response to Literature leads because it's the most-used mode.
 */
const DISPLAY_ORDER: readonly JswpMode[] = [
  "literary",
  "expository",
  "argumentation",
  "narrative",
];

/**
 * Picker-specific card copy. This is presentation content for the selection
 * screen, deliberately richer than the canonical `MODES[m].displayName` /
 * `.description` (which stay short for badges, headers, dropdowns). Modes
 * omitted here fall back to their MODES values. A paragraph's optional `lead`
 * renders as a bold label.
 */
type CardParagraph = { readonly lead?: string; readonly text: string };
type CardCopy = { readonly title: string; readonly body: readonly CardParagraph[] };

const CARD_COPY: Partial<Record<JswpMode, CardCopy>> = {
  literary: {
    title: "Response to Literature, Style Analysis, Rhetorical Analysis (1:2+)",
    body: [
      {
        text: "This mode of discourse is selected when a writer plans to analyze a novel, drama, short story, poem, or the aesthetics of fine arts creations. It is also selected when a writer plans to analyze an author’s style or rhetorical stance.",
      },
    ],
  },
  expository: {
    title: "Expository, Informational (2+:1)",
    body: [
      {
        text: "This mode of discourse is selected when a writer plans to provide an explanation or to inform the audience about a nonliterary topic or concept.",
      },
      {
        lead: "Core academic areas:",
        text: "mathematics, science, social sciences, social studies, and world languages.",
      },
      {
        lead: "Electives and specialized areas:",
        text: "computer science and technology, health and physical education, business and marketing, career and technical education (CTE) / Vocational.",
      },
      {
        lead: "Note:",
        text: "In the English language arts classroom, this mode is frequently selected to write a plot summary, to inform on a literary movement or historical event (e.g., Romanticism; The Great Depression), or to explain a literary theory (e.g., Freytag’s Pyramid).",
      },
    ],
  },
  argumentation: {
    title: "Argumentation (2+:1)",
    body: [
      {
        text: "This mode of discourse guides the writer how to reason systematically through the logical and classical steps of arguing for or against a nonliterary and debatable idea, action, issue, or theory. Three rhetorical devices in this mode of writing include concession, counterargument, and refutation.",
      },
    ],
  },
  narrative: {
    title: "Personal and Fictional Narrative (2+:1)",
    body: [
      {
        text: "This mode of discourse guides a writer who desires to tell a story, a personal story for a college admissions essay) or a fictional story for a standardized test or a creative outlet.",
      },
    ],
  },
};

export function ModePicker() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DISPLAY_ORDER.map((m) => {
        const cfg = MODES[m];
        const copy = CARD_COPY[m];
        const title = copy?.title ?? cfg.displayName;
        const body = copy?.body ?? [{ text: cfg.description }];
        return (
          <Link
            key={m}
            href={`/dashboard/assignments/new?mode=${m}`}
            className="group block bg-white border border-stone-200 rounded-xl shadow-sm p-5 hover:border-blue-500 hover:shadow-sm transition"
          >
            <div className="flex items-start gap-3">
              <Image
                src={ICONS[m]}
                alt=""
                width={48}
                height={48}
                className="w-12 h-12 mt-0.5 flex-shrink-0"
              />
              <div>
                <h2 className="font-semibold text-gray-900">{title}</h2>
                {body.map((para, i) => (
                  <p key={i} className="text-sm text-stone-600 mt-1">
                    {para.lead ? (
                      <span className="font-medium text-stone-700">
                        {para.lead}{" "}
                      </span>
                    ) : null}
                    {para.text}
                  </p>
                ))}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
