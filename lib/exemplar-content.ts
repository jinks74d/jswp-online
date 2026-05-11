/**
 * Exemplar content sanitization (chunk 6.6a).
 *
 * Server-side sanitization for HTML-formatted exemplars. Only a tiny
 * allowlist of tags + the `class` attribute + the JSWP_CONTENT_CLASSES
 * value-set survive. Anything outside that surface gets stripped.
 *
 * `removedAny` is returned alongside the sanitized output so the action
 * layer can refuse the save and surface a clean error to the teacher
 * rather than silently mutating their content. That makes paste-from-
 * Word and similar accidents visible.
 *
 * Runs server-side via DOMPurify + JSDOM. The legacy lib/sanitization.tsx
 * pattern (strip-all on server) isn't usable here — we need real
 * sanitization that preserves the JSWP markup we're enabling.
 */

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/**
 * The 10 JSWP color-code classes. Order matches CLAUDE.md §4.
 * `JSWP_CONTENT_LABELS` provides human-readable names for tooltips
 * and toolbar buttons (chunk 6.6b will consume these).
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

const JSWP_CLASS_SET = new Set<string>(JSWP_CONTENT_CLASSES);

const ALLOWED_TAGS = ["span", "p", "br", "em", "strong"];
const ALLOWED_ATTR = ["class"];

// Module-singleton JSDOM window for DOMPurify. JSDOM is heavy to
// instantiate; we create one window per process and reuse it.
const purifyWindow = new JSDOM("").window;
const DOMPurify = createDOMPurify(
  purifyWindow as unknown as Window & typeof globalThis
);

export interface SanitizeResult {
  sanitized: string;
  /** True when DOMPurify dropped tags/attrs OR when the class walker
   * removed disallowed classes / nested jswp-* spans. The action
   * layer rejects the save when this is true so teachers can review
   * what they pasted. */
  removedAny: boolean;
}

/**
 * Sanitize a teacher-submitted HTML exemplar.
 *
 *   1. DOMPurify pass — restricts tags + attrs.
 *   2. Class allowlist walker — for each surviving `class`, keep only
 *      JSWP_CONTENT_CLASSES values. If a class attribute becomes
 *      empty after filtering, remove it entirely.
 *   3. Nested-jswp-* unwrap — chunk 6.6's nested-marks rule (audit
 *      Q4): only outermost jswp-* spans survive. If a jswp-* span
 *      contains another jswp-* span, the inner one is unwrapped
 *      (text preserved, span removed).
 *
 * Returns the cleaned HTML + a flag indicating whether anything was
 * altered.
 */
export function sanitizeExemplarHtml(raw: string): SanitizeResult {
  let removedAny = false;

  // DOMPurify v3 exposes a `removed` array on the module for inspection
  // after each sanitize() call. We reset and read it to detect drops.
  const purify = DOMPurify as unknown as {
    sanitize: (html: string, config: Record<string, unknown>) => string;
    removed: unknown[];
  };
  purify.removed = [];
  const sanitized = purify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    USE_PROFILES: false,
  });
  if (purify.removed.length > 0) {
    removedAny = true;
  }

  // Post-process: class allowlist + nested-jswp-* unwrap.
  const { html: walked, removed: walkRemoved } = walkAndPrune(sanitized);
  if (walkRemoved) removedAny = true;

  return { sanitized: walked, removedAny };
}

/**
 * Post-DOMPurify walker:
 *  - Strips classes outside JSWP_CONTENT_CLASSES.
 *  - Unwraps nested jswp-* spans (only outermost wins).
 *  - Removes empty class attributes.
 *
 * DOMPurify has already restricted the tag/attr surface, so this only
 * needs to handle `<span class="…">` patterns and their children.
 * The input shape is tightly bounded — regex is adequate.
 */
function walkAndPrune(html: string): { html: string; removed: boolean } {
  let removed = false;

  // 1. Filter every class attribute against the allowlist.
  let next = html.replace(
    /class\s*=\s*"([^"]*)"/g,
    (_match, classes: string) => {
      const tokens = classes
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const kept = tokens.filter((t) => JSWP_CLASS_SET.has(t));
      if (kept.length !== tokens.length) removed = true;
      if (kept.length === 0) return ""; // strip the class= attribute
      return `class="${kept.join(" ")}"`;
    }
  );

  // 2. Clean up doubled-up whitespace inside tags ('<span  >') that
  //    the class strip can leave behind.
  next = next.replace(/<span\s+>/g, "<span>");

  // 3. Unwrap nested jswp-* spans. The pattern matches an outer
  //    jswp-* span that contains an inner jswp-* span anywhere in
  //    its body; replace the inner wrapper with just its text. Loop
  //    until stable so deeper nesting also unwinds.
  const nestedPattern =
    /(<span\s+class="jswp-[\w-]+">)((?:(?!<\/span>).)*?)<span\s+class="jswp-[\w-]+">([^<]*)<\/span>/i;
  while (nestedPattern.test(next)) {
    next = next.replace(nestedPattern, "$1$2$3");
    removed = true;
  }

  return { html: next, removed };
}

/**
 * Returns the sanitized HTML as plain text (no markup). Used by the
 * char-count display for HTML exemplars and any place that needs the
 * "what the student would read" string.
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
