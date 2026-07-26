/**
 * "From your annotations" — the commentary the student already wrote on the
 * Read & Annotate step, surfaced inside the T-Chart's CMs column so they can
 * pull it into the commentary clouds (Raymond, 2026-07-26: "whatever I wrote
 * in my annotation should be able to go here. The annotations should be
 * visible here, too").
 *
 * Every `cd` annotation carries required commentary in `note` (see the
 * annotate step), and a `cm` annotation is commentary in its own right — so
 * both kinds contribute. Other kinds (main idea, transition, note) are
 * margin-reading aids, not commentary, and are left out.
 *
 * Read-only by design: this is a reference, not a second place to edit. The
 * student retypes (and sharpens) the wording into a ray, which is the
 * Pick-n-Stitch move — copying it automatically would skip the thinking.
 *
 * Presentational only (no hooks) so it is safe in client and server trees.
 */

import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

export interface AnnotationCommentaryItem {
  readonly id: string;
  /** The source words the commentary is about; absent for a bare CM. */
  readonly quoted: string | null;
  readonly commentary: string;
}

/** Collapses the CR/LF and runs of whitespace that PDF-extracted text carries. */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Commentary the student wrote while annotating, in source order. Exported
 * for unit testing — see __tests__/lib/annotation-commentary.test.ts.
 */
export function selectAnnotationCommentary(
  annotations: readonly TextAnnotationRow[]
): AnnotationCommentaryItem[] {
  const items: AnnotationCommentaryItem[] = [];
  for (const a of annotations) {
    if (a.kind === "cd") {
      const note = tidy(a.note ?? "");
      if (note) {
        items.push({ id: a.id, quoted: tidy(a.selected_text), commentary: note });
      }
      continue;
    }
    if (a.kind === "cm") {
      // A CM annotation's own note refines the highlighted text; prefer it,
      // and fall back to the highlight itself.
      const commentary = tidy(a.note ?? "") || tidy(a.selected_text);
      if (commentary) items.push({ id: a.id, quoted: null, commentary });
    }
  }
  return items;
}

export function AnnotationCommentary({
  annotations,
}: {
  annotations: readonly TextAnnotationRow[];
}) {
  const items = selectAnnotationCommentary(annotations);
  if (items.length === 0) return null;

  return (
    <details
      open
      className="mt-3 rounded-md border border-emerald-300 bg-emerald-50/70 px-2.5 py-2"
    >
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
        From your annotations
        <span className="ml-1 font-normal normal-case text-emerald-700">
          — pull these into the clouds below
        </span>
      </summary>
      {/* Capped so a heavily-annotated source can't push the first CD far
          down the facing column; the list scrolls inside the panel. */}
      <ul className="mt-1.5 max-h-52 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="text-[13px] leading-snug">
            <span className="text-[color:var(--jswp-color-cm)]">
              {item.commentary}
            </span>
            {item.quoted && (
              <span className="block text-[11px] italic leading-tight text-gray-500">
                on “{item.quoted}”
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
