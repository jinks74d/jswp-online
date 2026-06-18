"use client";

/**
 * Faithful PDF renderer + annotator for the Read & Annotate step.
 * See docs/superpowers/specs/2026-06-16-pdf-annotate-design.md §5.
 *
 * Per page it draws the original PDF to a <canvas> (visual fidelity) and lays a
 * transparent, selectable text layer of absolutely-positioned spans over it.
 * Each span is tagged with `data-start-offset`, the character offset of its
 * text within `source_text`. Those offsets come from `buildPdfText` — the SAME
 * function that produced `source_text` at upload — so a DOM selection maps to a
 * stable offset by construction (no fuzzy alignment).
 *
 * Phase 4 wires the annotation behaviour, emitting the same `SelectionPayload`
 * and consuming the same `text_annotations` rows as `SourceTextViewer`, so the
 * popover, form, sidebar, Continue gate, and server actions are reused as-is:
 *   - selection → offset: on mouseup, map the selection endpoints' spans to
 *     `startOffset + localOffset` and emit `SelectionPayload`.
 *   - offset → highlight: for each visible annotation, find covered items and
 *     draw kind-colored overlay rects (multiply-blended so the PDF text shows
 *     through, like a highlighter). A collapsed click inside an annotation
 *     fires `onAnnotationClick`.
 *
 * The heavy PDF render runs once per `fileUrl`; highlights redraw on a separate
 * effect so annotation edits don't repaint the canvas. pdf.js is browser-only
 * (Web Worker + canvas), so it runs inside a mount-gated effect; SSR renders
 * just the shell to avoid a hydration mismatch. The robust flat-text fallback
 * is Phase 6; here a failure shows a notice + "Open original".
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdf-worker";
import {
  buildPdfText,
  isPositionedTextItem,
  itemsCoveringRange,
  pageFromPdfJsItems,
  type PdfJsTextItemLike,
  type PdfTextSegment,
} from "@/lib/pdf-text";
import { ANNOTATION_KINDS, type AnnotationKind } from "./annotation-kind-config";
import type { SelectionPayload } from "./source-text-viewer";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

interface Props {
  /** Short-lived signed URL to the stored PDF (minted server-side). */
  fileUrl: string;
  /**
   * The authoritative annotation substrate (stored at upload by buildPdfText).
   * We re-derive text from the live PDF at render and assert it MATCHES this;
   * a mismatch (e.g. a pdfjs-dist version bump changed extraction) would mean
   * offsets no longer line up, so we fall back rather than mis-highlight.
   */
  sourceText: string;
  annotations: readonly TextAnnotationRow[];
  visibleKinds: ReadonlySet<AnnotationKind>;
  /** Annotation id to scroll into view; cleared by parent after use. */
  scrollToAnnotationId: string | null;
  onSelection?: (payload: SelectionPayload) => void;
  onClearSelection?: () => void;
  onAnnotationClick?: (annotation: TextAnnotationRow) => void;
  /** Render highlights but disable selection + click-to-edit (reference panels). */
  readOnly?: boolean;
  /**
   * Called when pdf.js can't render (load/worker/fetch/render failure or an
   * expired URL). The parent should swap to the flat SourceTextViewer over the
   * same source_text — annotation never depends on pdf.js succeeding (spec §6).
   */
  onLoadError?: () => void;
}

/** Clamp a fit-to-width scale so canvases never get absurdly large/small. */
const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
const FALLBACK_WIDTH = 800;

/**
 * Overlay style per kind. Fills are multiply-blended (so dark PDF glyphs stay
 * visible through the tint); main_idea echoes the guide's underline-in-black.
 * Class strings are literal so Tailwind's scanner keeps them.
 */
const OVERLAY: Record<AnnotationKind, { className: string; underline?: boolean }> =
  {
    main_idea: { className: "", underline: true },
    cd: { className: "bg-red-300" },
    cm: { className: "bg-green-300" },
    transition: { className: "bg-sky-300" },
    note: { className: "bg-gray-300" },
  };

interface PageLayer {
  readonly pageWrap: HTMLDivElement;
  readonly highlightLayer: HTMLDivElement;
}

interface RenderState {
  readonly text: string;
  readonly segments: readonly PdfTextSegment[];
  readonly spanByOffset: Map<number, { span: HTMLSpanElement; pageIndex: number }>;
  readonly pages: PageLayer[];
}

/** Map a selection endpoint (node + local offset) to a global source offset. */
function offsetFromNode(node: Node | null, localOffset: number): number | null {
  if (!node) return null;
  const el =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as Element | null);
  const span = el?.closest<HTMLElement>("[data-start-offset]");
  if (!span) return null;
  const base = Number(span.dataset.startOffset);
  if (Number.isNaN(base)) return null;
  return base + localOffset;
}

function annotationAt(
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>,
  offset: number
): TextAnnotationRow | null {
  for (const a of annotations) {
    if (
      visibleKinds.has(a.kind) &&
      a.range_start <= offset &&
      offset < a.range_end
    ) {
      return a;
    }
  }
  return null;
}

function clearHighlights(state: RenderState) {
  for (const p of state.pages) p.highlightLayer.replaceChildren();
}

function drawHighlights(
  state: RenderState,
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>
) {
  clearHighlights(state);
  for (const a of annotations) {
    if (!visibleKinds.has(a.kind)) continue;
    if (a.range_start >= state.text.length) continue;

    const overlay = OVERLAY[a.kind];
    const covered = itemsCoveringRange(state.segments, a.range_start, a.range_end);
    for (const { item, fromChar, toChar } of covered) {
      const info = state.spanByOffset.get(item.startOffset);
      const textNode = info?.span.firstChild;
      if (!info || !textNode) continue;

      const range = document.createRange();
      try {
        range.setStart(textNode, fromChar);
        range.setEnd(textNode, toChar);
      } catch {
        continue;
      }

      const page = state.pages[info.pageIndex];
      const wrap = page.pageWrap.getBoundingClientRect();
      for (const r of Array.from(range.getClientRects())) {
        const div = document.createElement("div");
        div.dataset.annotationId = a.id;
        // Non-color signal (CLAUDE.md §9), matching SourceTextViewer's <mark
        // title>: the kind name is exposed for hover + assistive tech.
        div.title = ANNOTATION_KINDS[a.kind].label;
        div.style.position = "absolute";
        div.style.left = `${r.left - wrap.left}px`;
        div.style.top = `${r.top - wrap.top}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        if (overlay.underline) {
          // main_idea: underline-in-black convention; gray-800 token (no hex).
          div.className = "border-b-2 border-gray-800";
        } else {
          div.className = overlay.className;
          div.style.mixBlendMode = "multiply";
          div.style.borderRadius = "2px";
        }
        page.highlightLayer.appendChild(div);
      }
    }
  }
}

export function PdfSourceViewer({
  fileUrl,
  sourceText,
  annotations,
  visibleKinds,
  scrollToAnnotationId,
  onSelection,
  onClearSelection,
  onAnnotationClick,
  readOnly = false,
  onLoadError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderStateRef = useRef<RenderState | null>(null);
  // "scanned": image-only PDF with no text layer — canvas is readable but
  // there's nothing to select, so annotation is impossible (surfaced, not
  // silently broken). "error": pdf.js failed; the parent falls back to flat.
  const [status, setStatus] = useState<
    "loading" | "ready" | "scanned" | "error"
  >("loading");

  // Heavy render: runs once per fileUrl. Annotation edits do NOT repaint here.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    renderStateRef.current = null;
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

        container.innerHTML = ""; // clear any prior render

        const targetWidth = container.clientWidth || FALLBACK_WIDTH;
        const dpr = window.devicePixelRatio || 1;

        const rendered: {
          viewport: { transform: number[]; scale: number };
          textLayer: HTMLDivElement;
          highlightLayer: HTMLDivElement;
          pageWrap: HTMLDivElement;
          items: readonly unknown[];
        }[] = [];

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
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2d context unavailable");

          // Visual highlight layer (below the text layer, never grabs pointers).
          const highlightLayer = document.createElement("div");
          highlightLayer.className = "absolute inset-0 pointer-events-none";

          // Transparent, selectable text layer on top.
          const textLayer = document.createElement("div");
          textLayer.className =
            "absolute inset-0 overflow-hidden leading-none select-text";
          textLayer.style.color = "transparent";

          pageWrap.appendChild(canvas);
          pageWrap.appendChild(highlightLayer);
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
            highlightLayer,
            pageWrap,
            items: textContent.items,
          });
        }

        // Canonical offsets over every page IN ORDER → matches source_text.
        // Segments align 1:1 with positioned items (same predicate).
        const { text: fullText, items: segments } = buildPdfText(
          rendered.map((p) => pageFromPdfJsItems(p.items))
        );

        // Scanned/image PDF: canvas rendered fine but there's no text layer.
        // Leave the (readable) canvases up, skip the text layer, and tell the
        // student annotation isn't possible on an image. Not an error.
        if (!fullText.trim()) {
          if (!cancelled) setStatus("scanned");
          return;
        }

        // Offset-invariant guard: the live extraction MUST equal the stored
        // substrate, or every annotation offset is miscalibrated and we'd
        // highlight the wrong characters. If they diverge (e.g. a pdfjs-dist
        // bump changed extraction since this PDF was uploaded), bail to the
        // flat viewer over the authoritative source_text — a wrong highlight
        // is worse than a plain one. The log makes drift diagnosable.
        if (fullText !== sourceText) {
          console.warn(
            `pdf text/source_text mismatch (live ${fullText.length} vs stored ${sourceText.length}); falling back to flat viewer`
          );
          if (!cancelled) {
            setStatus("error");
            onLoadError?.();
          }
          return;
        }

        const Util = pdfjs.Util;
        const spanByOffset = new Map<
          number,
          { span: HTMLSpanElement; pageIndex: number }
        >();
        const toScale: { span: HTMLSpanElement; target: number }[] = [];
        let seg = 0;

        rendered.forEach((p, pageIndex) => {
          for (const raw of p.items) {
            if (!isPositionedTextItem(raw)) continue;
            const item = raw as PdfJsTextItemLike;
            const s = segments[seg++];

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

            spanByOffset.set(s.startOffset, { span, pageIndex });
            toScale.push({ span, target: item.width * p.viewport.scale });
          }
        });

        // Scale each span horizontally to the PDF glyph advance (the standard
        // text-layer trick). Batched after appends → one reflow.
        for (const { span, target } of toScale) {
          const measured = span.getBoundingClientRect().width;
          if (measured > 0 && target > 0) {
            span.style.transform = `scaleX(${target / measured})`;
          }
        }

        if (cancelled) return;
        renderStateRef.current = {
          text: fullText,
          segments,
          spanByOffset,
          pages: rendered.map((p) => ({
            pageWrap: p.pageWrap,
            highlightLayer: p.highlightLayer,
          })),
        };
        drawHighlights(renderStateRef.current, annotations, visibleKinds);
        setStatus("ready");
      } catch (e) {
        console.error("pdf render:", e);
        if (!cancelled) {
          setStatus("error");
          // Hand control back so the parent can fall back to the flat,
          // still-annotatable viewer over the same source_text (spec §6).
          onLoadError?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      renderStateRef.current = null;
      loadingTask?.destroy().catch(() => {});
    };
    // Render depends only on the PDF; annotation props are read at draw time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Light redraw on annotation / visibility changes (no canvas repaint).
  useEffect(() => {
    const s = renderStateRef.current;
    if (s) drawHighlights(s, annotations, visibleKinds);
  }, [annotations, visibleKinds]);

  // Scroll an annotation into view when the parent asks.
  useEffect(() => {
    if (!scrollToAnnotationId) return;
    const s = renderStateRef.current;
    if (!s) return;
    for (const p of s.pages) {
      const el = p.highlightLayer.querySelector(
        `[data-annotation-id="${scrollToAnnotationId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }, [scrollToAnnotationId]);

  const handleMouseUp = () => {
    if (readOnly) return;
    const s = renderStateRef.current;
    if (!s) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      onClearSelection?.();
      return;
    }

    if (sel.isCollapsed) {
      const off = offsetFromNode(sel.anchorNode, sel.anchorOffset);
      const hit = off === null ? null : annotationAt(annotations, visibleKinds, off);
      if (hit) onAnnotationClick?.(hit);
      else onClearSelection?.();
      return;
    }

    const a1 = offsetFromNode(sel.anchorNode, sel.anchorOffset);
    const a2 = offsetFromNode(sel.focusNode, sel.focusOffset);
    if (a1 === null || a2 === null) {
      onClearSelection?.();
      return;
    }
    const start = Math.max(0, Math.min(a1, a2));
    const end = Math.min(s.text.length, Math.max(a1, a2));
    if (end - start < 1) {
      onClearSelection?.();
      return;
    }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    onSelection?.({
      rangeStart: start,
      rangeEnd: end,
      selectedText: s.text.slice(start, end),
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
    });
  };

  return (
    <div className="space-y-2">
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading PDF…
        </div>
      )}
      {status === "scanned" && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          This PDF has no selectable text (it looks scanned), so it can’t be
          highlighted. You can still read it below or use “Open original.”
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="text-sm text-red-700">
          Couldn’t display the PDF here. Use “Open original” to view it.
        </div>
      )}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="space-y-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-100 p-3"
      />
    </div>
  );
}
