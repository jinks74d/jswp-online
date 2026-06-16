/**
 * Source-text rich-content helpers — pure implementation (no server-only
 * guard) so both the app (via lib/source-content.ts) and node tooling (the
 * backfill script) can reuse the exact same sanitizer + substrate projection.
 * See docs/SOURCE_TEXT_ARCHITECTURE.md.
 *
 * Pulls in jsdom for DOMPurify's DOM provider and for the substrate
 * projection. App code must import the server-only re-export
 * (lib/source-content.ts), NOT this module directly, so jsdom never lands in a
 * client bundle.
 *
 * Two responsibilities:
 *   1. sanitizeSourceHtml  — formatted-prose allowlist (headings / bold /
 *      italic / underline / lists / tables / blockquotes / links / images).
 *   2. sourceHtmlToSubstrate — project the sanitized HTML to the exact plain
 *      string the annotation engine indexes. This MUST equal the concatenation
 *      of text-node content a DOM TreeWalker(SHOW_TEXT) would sum over the same
 *      HTML — verbatim, with NO whitespace collapse and NO injected newlines.
 */

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

// Formatted-prose surface for source bodies: structure + light formatting,
// tables, blockquotes, links, and images (mammoth emits docx images as inline
// data: URIs). No class/style/id — source text is read-and-annotate material.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
];
const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt"];

// Image sources are limited to inline data: URIs (mammoth's encoding) and
// https:. DOMPurify already strips javascript:/other dangerous URIs; this
// narrows the remaining safe set for <img>.
const SAFE_IMG_SCHEME = /^(data:|https:)/i;

// Module-singleton JSDOM window for DOMPurify (heavy to instantiate).
const purifyWindow = new JSDOM("").window;
const DOMPurify = createDOMPurify(
  purifyWindow as unknown as Window & typeof globalThis
);

// Force safe link behavior and clamp image schemes. Runs after DOMPurify's own
// attribute sanitization, so what we set here is final.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!(node instanceof purifyWindow.HTMLElement)) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "a" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
  if (tag === "img") {
    const src = node.getAttribute("src") ?? "";
    if (!SAFE_IMG_SCHEME.test(src)) node.removeAttribute("src");
  }
});

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
 * this safe under concurrent callers.
 */
export function sourceHtmlToSubstrate(html: string): string {
  const { window } = new JSDOM(`<body>${html}</body>`);
  return window.document.body.textContent ?? "";
}
