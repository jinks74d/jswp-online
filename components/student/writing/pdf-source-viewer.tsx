"use client";

/**
 * Faithful PDF renderer for the Read & Annotate step (Phase 3 — display slice).
 * See docs/superpowers/specs/2026-06-16-pdf-annotate-design.md §5.
 *
 * Per page it draws the original PDF to a <canvas> (visual fidelity) and lays a
 * transparent text layer of absolutely-positioned spans over it. Each span is
 * tagged with `data-start-offset`, the character offset of its text within
 * `source_text`. Those offsets come from `buildPdfText` — the SAME function
 * that produced `source_text` at upload — so a future DOM selection maps to a
 * stable offset by construction (no fuzzy alignment).
 *
 * This phase is display-only: the text is transparent and selection/highlight
 * are NOT wired yet (Phase 4). pdf.js is browser-only (Web Worker + canvas), so
 * everything runs inside a mount-gated effect; SSR renders just the shell to
 * avoid a hydration mismatch — the same approach DocxViewer/SourceTextViewer
 * use. The robust flat-text fallback is Phase 6; here a failure shows a notice.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdf-worker";
import {
  buildPdfText,
  isPositionedTextItem,
  pageFromPdfJsItems,
  type PdfJsTextItemLike,
} from "@/lib/pdf-text";

interface Props {
  /** Short-lived signed URL to the stored PDF (minted server-side). */
  fileUrl: string;
}

/** Clamp a fit-to-width scale so canvases never get absurdly large/small. */
const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
const FALLBACK_WIDTH = 800;

interface RenderedPage {
  readonly viewport: { transform: number[]; scale: number };
  readonly textLayer: HTMLDivElement;
  readonly items: readonly unknown[];
}

export function PdfSourceViewer({ fileUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        setStatus("loading");
        const pdfjs = await loadPdfjs();

        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjs.getDocument({ data });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        // Clear any prior render (the effect re-runs if fileUrl changes).
        container.innerHTML = "";

        // Fit each page to the container width (capped), accounting for HiDPI.
        const targetWidth = container.clientWidth || FALLBACK_WIDTH;
        const dpr = window.devicePixelRatio || 1;

        const rendered: RenderedPage[] = [];

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum);
          if (cancelled) return;

          const baseWidth = page.getViewport({ scale: 1 }).width;
          const scale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, targetWidth / baseWidth)
          );
          const viewport = page.getViewport({ scale });

          const pageWrap = document.createElement("div");
          pageWrap.className =
            "relative mx-auto bg-white shadow-sm ring-1 ring-gray-200";
          pageWrap.style.width = `${viewport.width}px`;
          pageWrap.style.height = `${viewport.height}px`;

          const canvas = document.createElement("canvas");
          // Back the canvas at device resolution for crisp text, but lay it out
          // at CSS size so the text layer (in CSS px) aligns to it.
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2d context unavailable");

          const textLayer = document.createElement("div");
          // Transparent overlay; spans get absolute positions against it.
          textLayer.className =
            "absolute inset-0 overflow-hidden leading-none";
          textLayer.style.color = "transparent";

          pageWrap.appendChild(canvas);
          pageWrap.appendChild(textLayer);
          container.appendChild(pageWrap);

          // pdf.js v6 requires the canvas element (not just the 2d context).
          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;
          if (cancelled) return;

          const textContent = await page.getTextContent();
          if (cancelled) return;

          rendered.push({
            viewport: { transform: viewport.transform, scale },
            textLayer,
            items: textContent.items,
          });
        }

        // Offsets: run the canonical function over every page IN ORDER, so each
        // segment's startOffset matches source_text exactly. Segments align 1:1
        // with the positioned items (both filtered by isPositionedTextItem).
        const segments = buildPdfText(
          rendered.map((p) => pageFromPdfJsItems(p.items))
        ).items;

        const Util = pdfjs.Util;
        let seg = 0;
        const toScale: { span: HTMLSpanElement; target: number }[] = [];

        for (const p of rendered) {
          for (const raw of p.items) {
            if (!isPositionedTextItem(raw)) continue;
            const item = raw as PdfJsTextItemLike;
            const s = segments[seg++];

            // Map the item's text-space transform into viewport pixels.
            const tx = Util.transform(p.viewport.transform, item.transform);
            const fontHeight = Math.hypot(tx[2], tx[3]);
            const span = document.createElement("span");
            span.textContent = item.str;
            span.dataset.startOffset = String(s.startOffset);
            span.style.position = "absolute";
            span.style.whiteSpace = "pre";
            span.style.transformOrigin = "0% 0%";
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - fontHeight}px`;
            span.style.fontSize = `${fontHeight}px`;
            span.style.fontFamily = "sans-serif";
            p.textLayer.appendChild(span);

            toScale.push({ span, target: item.width * p.viewport.scale });
          }
        }

        // Second pass: scale each span horizontally so its box matches the
        // glyph advance from the PDF (the standard pdf.js text-layer trick).
        // Batched after all appends to incur a single reflow.
        for (const { span, target } of toScale) {
          const measured = span.getBoundingClientRect().width;
          if (measured > 0 && target > 0) {
            span.style.transform = `scaleX(${target / measured})`;
          }
        }

        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.error("pdf render:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => {});
    };
  }, [fileUrl]);

  return (
    <div className="space-y-2">
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading PDF…
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="text-sm text-red-700">
          Couldn’t display the PDF here. Use “Open original” to view it.
        </div>
      )}
      <div
        ref={containerRef}
        className="space-y-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-100 p-3"
      />
    </div>
  );
}
