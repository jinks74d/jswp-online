/**
 * Compose a body paragraph's color-coded prose from its tagged Shaping
 * Sheet sentences (chunk 4.5d-3). The Paragraph Form artifact is the
 * assembled paragraph in JSWP color — TS (blue) → per-chunk CD (red) +
 * CM (green) → CS (blue) — not a free-text retype
 * (docs/reference/expository-organizer-specs.md → "Paragraph Form").
 *
 * Returns an ordered list of role-tagged segments so the UI can render
 * each in its color; the plain joined text seeds paragraph_forms.final_text
 * (which Final Draft assembly reads). At 3+:0 a chunk simply has no CM
 * sentences, so no green renders — no ratio flag needed here.
 *
 * Pure + dependency-free (unit-tested in __tests__/lib/compose-paragraph.test.ts).
 */

export type SegmentRole = "ts" | "cd" | "cm" | "cs" | "other";

export interface ParagraphSegment {
  readonly role: SegmentRole;
  readonly text: string;
}

export interface ComposeChunkInput {
  readonly cd_sentences: readonly string[];
  readonly cm_sentences: readonly string[];
}

export interface ComposeInput {
  readonly topicSentence: string | null;
  readonly chunks: readonly ComposeChunkInput[];
  /** Argumentation only — appended before the concluding sentence. */
  readonly concession?: string | null;
  readonly counterargument?: string | null;
  readonly refutation?: string | null;
  readonly concludingSentence: string | null;
}

function clean(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function pushIf(
  segments: ParagraphSegment[],
  role: SegmentRole,
  text: string | null | undefined
): void {
  const t = clean(text);
  if (t.length > 0) segments.push({ role, text: t });
}

/** Build the ordered, role-tagged segment list for a paragraph. */
export function composeParagraphSegments(
  input: ComposeInput
): ParagraphSegment[] {
  const segments: ParagraphSegment[] = [];

  pushIf(segments, "ts", input.topicSentence);

  for (const chunk of input.chunks) {
    for (const cd of chunk.cd_sentences) pushIf(segments, "cd", cd);
    for (const cm of chunk.cm_sentences) pushIf(segments, "cm", cm);
  }

  pushIf(segments, "other", input.concession);
  pushIf(segments, "other", input.counterargument);
  pushIf(segments, "other", input.refutation);

  pushIf(segments, "cs", input.concludingSentence);

  return segments;
}

/** Flatten segments to the plain paragraph text used to seed final_text. */
export function composeParagraphText(input: ComposeInput): string {
  return composeParagraphSegments(input)
    .map((s) => s.text)
    .join(" ");
}
