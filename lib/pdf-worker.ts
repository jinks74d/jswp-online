/**
 * One-time pdf.js worker configuration + lazy loader (Phase 0 of the PDF
 * annotate plan; see docs/superpowers/specs/2026-06-16-pdf-annotate-design.md
 * §3).
 *
 * pdf.js is browser-only here (it needs a Web Worker + canvas), so it is
 * dynamically imported from inside client effects to stay out of the initial
 * bundle — the same pattern docx-viewer uses for docx-preview. The worker is
 * configured exactly once; concurrent callers share the single in-flight import
 * via a cached promise.
 *
 * Phase 2 (server-side extraction) loads pdfjs differently (no worker/canvas in
 * Node) and is intentionally NOT routed through this browser loader.
 */

import type * as PdfjsModule from "pdfjs-dist";

type Pdfjs = typeof PdfjsModule;

let pdfjsPromise: Promise<Pdfjs> | null = null;

/**
 * Lazily import pdf.js and configure its worker exactly once. Returns the
 * configured module; safe to call repeatedly (the promise is memoized).
 */
export function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    // Bundler-resolved worker URL: webpack/Turbopack recognize the
    // `new URL(<specifier>, import.meta.url)` form, emit pdf.worker.min.mjs as a
    // hashed static asset, and rewrite this to its final URL at build time. This
    // keeps the worker version locked to the API version (mismatches are a
    // common pdf.js runtime error) without copying anything into /public.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    return pdfjs;
  })();
  return pdfjsPromise;
}
