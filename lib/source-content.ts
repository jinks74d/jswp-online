/**
 * Source-text rich-content helpers (Chunk 1 of the structured-source work;
 * see docs/SOURCE_TEXT_ARCHITECTURE.md).
 *
 * SERVER ONLY — pulls in jsdom for DOMPurify's DOM provider and for the
 * substrate projection. The teacher form posts candidate HTML (from the
 * minimal contentEditable editor or a .docx conversion); this module is the
 * single place that cleans it and derives the canonical annotation substrate.
 *
 * Two responsibilities:
 *   1. sanitizeSourceHtml  — general-prose allowlist (headings / bold / italic
 *      / underline / lists). Distinct from the exemplar sanitizer, which only
 *      allows JSWP color classes, not formatting tags.
 *   2. sourceHtmlToSubstrate — project the sanitized HTML to the exact plain
 *      string the annotation engine indexes. This MUST equal the concatenation
 *      of text-node content a DOM TreeWalker(SHOW_TEXT) would sum over the same
 *      HTML — verbatim, with NO whitespace collapse and NO injected newlines.
 *      (htmlToPlainText in exemplar-content-shared collapses whitespace, so it
 *      is deliberately NOT used here — it would desync annotation offsets.)
 */

import "server-only";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

// General-prose formatting surface for source bodies. No class/style/href —
// source text is read-and-annotate material, not interactive content.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
];
const ALLOWED_ATTR: string[] = [];

// Module-singleton JSDOM window for DOMPurify (heavy to instantiate).
const purifyWindow = new JSDOM("").window;
const DOMPurify = createDOMPurify(
  purifyWindow as unknown as Window & typeof globalThis
);

/**
 * Sanitize a teacher-submitted rich source body down to the prose allowlist.
 * Returns clean HTML; disallowed tags are dropped but their text is kept
 * (KEEP_CONTENT), so nothing the teacher wrote silently disappears.
 */
export function sanitizeSourceHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    USE_PROFILES: false,
  });
}

/**
 * Project sanitized source HTML to the canonical annotation substrate: the
 * verbatim text content, matching exactly what a DOM TreeWalker(SHOW_TEXT)
 * sums over the same HTML when rendered. No normalization, no injected
 * newlines — this is the string text_annotations offsets point into.
 *
 * A fresh JSDOM per call (rather than mutating the shared purifyWindow) keeps
 * this safe under concurrent server actions; it runs only on assignment save.
 */
export function sourceHtmlToSubstrate(html: string): string {
  const { window } = new JSDOM(`<body>${html}</body>`);
  return window.document.body.textContent ?? "";
}
