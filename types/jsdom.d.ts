/**
 * Minimal ambient declaration for jsdom.
 *
 * We use jsdom only as a DOM provider for DOMPurify's server-side
 * sanitization in lib/exemplar-content.ts. The full @types/jsdom
 * package isn't installed (CLAUDE.md §3 — no new deps without
 * approval); this stub covers the one surface we touch.
 *
 * If we expand jsdom usage beyond this, swap to @types/jsdom.
 */

declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
