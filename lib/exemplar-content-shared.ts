/**
 * Client-safe exemplar content helpers (chunk 6.6b split).
 *
 * `lib/exemplar-content.ts` brings in jsdom (server-only) for
 * sanitization. The browser bundle can't include jsdom, so the
 * client-needed pieces — the class allowlist, labels, and the
 * pure-string htmlToPlainText — live here.
 *
 * Server code should import from this file too when it doesn't
 * need the sanitizer; that keeps the dependency direction one-way:
 * exemplar-content.ts → exemplar-content-shared.ts.
 */

/**
 * The 10 JSWP color-code classes. Order matches CLAUDE.md §4.
 */
export const JSWP_CONTENT_CLASSES = [
  "jswp-ts",
  "jswp-cs",
  "jswp-cd",
  "jswp-cm",
  "jswp-thesis",
  "jswp-intro",
  "jswp-conclusion",
  "jswp-concession",
  "jswp-counterargument",
  "jswp-refutation",
] as const;

export type JswpContentClass = (typeof JSWP_CONTENT_CLASSES)[number];

export const JSWP_CONTENT_LABELS: Record<JswpContentClass, string> = {
  "jswp-ts": "Topic Sentence",
  "jswp-cs": "Concluding Sentence",
  "jswp-cd": "Concrete Detail",
  "jswp-cm": "Commentary",
  "jswp-thesis": "Thesis",
  "jswp-intro": "Introduction",
  "jswp-conclusion": "Conclusion",
  "jswp-concession": "Concession",
  "jswp-counterargument": "Counterargument",
  "jswp-refutation": "Refutation",
};

/**
 * Strip tags + decode common entities to get the rendered text.
 * Used by the form's word-count display and any other place that
 * needs "what the student would actually read."
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
