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
 *
 * Keyboard create path (see docs/.../2026-06-22-pdf-keyboard-selection-design.md):
 * the text layer is otherwise mouse-only — placing a caret in static <span>s
 * needs caret-browsing (F7), which is off by default, so a keyboard-only user
 * couldn't START a selection. We add a managed span-navigation mode: the
 * container is ONE tab stop (role="application"), a roving cursor (an index into
 * the navigable segments) moves by word (←/→) or line (↑/↓), Shift+Arrow extends
 * from an anchor, Enter commits via the SAME emit path the mouse uses, and Esc
 * cancels/exits. The cursor and selection are surfaced to AT via
 * aria-activedescendant + a polite live region. No new offset model: the cursor
 * is just an index into `segments`, whose offsets already map to source_text.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdf-worker";
import {
  buildPdfText,
  isPositionedTextItem,
  itemsCoveringRange,
  marginMask,
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
  /**
   * Called when the PDF renders but has no selectable text (scanned/image-only),
   * so highlighting is impossible. The parent uses this to relax the Continue
   * gate: a teacher's image-only file must not permanently trap a student on a
   * required-annotate step (spec §6; image PDFs surface, not silently break).
   */
  onUnannotatable?: () => void;
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
  /**
   * Keyboard-navigation view: indices into `segments` that are real stops (a
   * span exists for them and they aren't whitespace-only). The roving cursor is
   * an index into THIS array, so word stepping is ±1 and the cursor never lands
   * on an invisible run (spec §7).
   */
  readonly navStops: readonly number[];
  /** Stable DOM id of each segment's span (for aria-activedescendant). */
  readonly spanIdByOffset: Map<number, string>;
}

/** Unique-per-mount prefix so span ids don't collide across remounts. */
let pdfTextLayerSeq = 0;

/** Marquee divs (transient selection chrome) are tagged so they're separable. */
const MARQUEE_ATTR = "data-kbd-marquee";

/**
 * Pure navigation reducer: given the navigable stops, the current cursor index
 * (into navStops), and a movement intent, return the next cursor index. Word
 * moves are ±1; line moves jump to the first stop of the adjacent visual line
 * (line membership = same page + close baseline y); Home/End snap to the line's
 * ends; doc-home/end go to the extremes. Kept pure so it's unit-testable with
 * synthetic segments (spec §9 phase 0) and never touches the DOM.
 */
type NavIntent =
  | "word-next"
  | "word-prev"
  | "line-next"
  | "line-prev"
  | "line-home"
  | "line-end"
  | "doc-home"
  | "doc-end";

/** Same visual line ≈ same page and a baseline within ~half a glyph height. */
function sameLine(a: PdfTextSegment, b: PdfTextSegment): boolean {
  if (a.pageIndex !== b.pageIndex) return false;
  const meanGlyph =
    a.str.length > 0 ? a.width / a.str.length : a.width || 1;
  return Math.abs(a.y - b.y) <= Math.max(1, meanGlyph * 0.6);
}

function navigate(
  segments: readonly PdfTextSegment[],
  navStops: readonly number[],
  current: number,
  intent: NavIntent
): number {
  if (navStops.length === 0) return 0;
  const clamp = (i: number): number =>
    Math.max(0, Math.min(navStops.length - 1, i));
  const seg = (navPos: number): PdfTextSegment => segments[navStops[clamp(navPos)]];

  switch (intent) {
    case "word-next":
      return clamp(current + 1);
    case "word-prev":
      return clamp(current - 1);
    case "doc-home":
      return 0;
    case "doc-end":
      return navStops.length - 1;
    case "line-home": {
      const cur = seg(current);
      let i = current;
      while (i > 0 && sameLine(seg(i - 1), cur)) i--;
      return i;
    }
    case "line-end": {
      const cur = seg(current);
      let i = current;
      while (i < navStops.length - 1 && sameLine(seg(i + 1), cur)) i++;
      return i;
    }
    case "line-prev": {
      const cur = seg(current);
      // Walk back off the current line, then to the start of that prior line.
      let i = current;
      while (i > 0 && sameLine(seg(i - 1), cur)) i--;
      if (i === 0) return 0; // already on the first line
      const prevLine = seg(i - 1);
      let j = i - 1;
      while (j > 0 && sameLine(seg(j - 1), prevLine)) j--;
      return j;
    }
    case "line-next": {
      const cur = seg(current);
      let i = current;
      while (i < navStops.length - 1 && sameLine(seg(i + 1), cur)) i++;
      if (i === navStops.length - 1) return navStops.length - 1; // last line
      return i + 1; // first stop of the next line
    }
    default:
      return current;
  }
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

/** Short, screen-reader-friendly label for a highlight: kind + a text snippet. */
function annotationLabel(state: RenderState, a: TextAnnotationRow): string {
  const snippet = state.text.slice(a.range_start, a.range_end).trim();
  const clipped = snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet;
  return `${ANNOTATION_KINDS[a.kind].label} annotation: ${clipped}`;
}

function drawHighlights(
  state: RenderState,
  annotations: readonly TextAnnotationRow[],
  visibleKinds: ReadonlySet<AnnotationKind>,
  // When interactive, the first rect of each annotation becomes a real keyboard
  // control (Tab to reach, Enter/Space to open its editor) — the canvas overlay
  // is otherwise mouse-only, which fails WCAG-AA (CLAUDE.md §9, spec §10).
  interactive: boolean,
  onAnnotationClick?: (annotation: TextAnnotationRow) => void
) {
  clearHighlights(state);
  for (const a of annotations) {
    if (!visibleKinds.has(a.kind)) continue;
    if (a.range_start >= state.text.length) continue;

    const overlay = OVERLAY[a.kind];
    const covered = itemsCoveringRange(state.segments, a.range_start, a.range_end);
    // Only the first rect of a (possibly multi-line) annotation is a tab stop,
    // so each annotation is one keyboard control, not one-per-wrapped-line.
    let firstRect = true;
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
        if (interactive && firstRect && onAnnotationClick) {
          firstRect = false;
          div.tabIndex = 0;
          div.setAttribute("role", "button");
          div.setAttribute("aria-label", annotationLabel(state, a));
          // Kept under the layer's pointer-events-none (so the mouse can still
          // select text through a highlight); Tab focus + keydown are unaffected
          // by pointer-events, so this is the keyboard-only edit path. A visible
          // focus ring is required (the tint alone isn't a focus cue).
          div.classList.add(
            "focus-visible:outline",
            "focus-visible:outline-2",
            "focus-visible:outline-offset-2",
            "focus-visible:outline-sky-600"
          );
          div.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAnnotationClick(a);
            }
          });
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
  onUnannotatable,
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
        // Segments align 1:1 with the positioned items that SURVIVE the margin
        // mask (same predicate, same mask as buildPdfText applies internally).
        const maskedPages = rendered.map((p) => pageFromPdfJsItems(p.items));
        const { text: fullText, items: segments } = buildPdfText(maskedPages);
        const keepMask = marginMask(maskedPages);

        // Scanned/image PDF: canvas rendered fine but there's no text layer.
        // Leave the (readable) canvases up, skip the text layer, and tell the
        // student annotation isn't possible on an image. Not an error.
        if (!fullText.trim()) {
          if (!cancelled) {
            setStatus("scanned");
            // Tell the parent annotation is impossible here so it can relax the
            // required-annotate Continue gate (student must not get trapped).
            onUnannotatable?.();
          }
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
        const spanIdByOffset = new Map<number, string>();
        const toScale: { span: HTMLSpanElement; target: number }[] = [];
        // Per-mount id prefix so spans get stable, collision-free DOM ids for
        // aria-activedescendant (the active word must be addressable by id).
        const idPrefix = `pdf-tl-${pdfTextLayerSeq++}`;
        let seg = 0;

        rendered.forEach((p, pageIndex) => {
          // Index into THIS page's positioned items, to read the margin mask.
          let posIndex = 0;
          for (const raw of p.items) {
            if (!isPositionedTextItem(raw)) continue;
            const kept = keepMask[pageIndex][posIndex++];
            // Margin furniture: no text-layer span, so it is neither
            // selectable nor keyboard-reachable, matching its absence from
            // source_text. The page canvas still shows it — we exclude it
            // from the annotatable text, we do not censor the page image.
            if (!kept) continue;
            const item = raw as PdfJsTextItemLike;
            const s = segments[seg++];

            const tx = Util.transform(p.viewport.transform, item.transform);
            const fontHeight = Math.hypot(tx[2], tx[3]);
            const span = document.createElement("span");
            // The SEGMENT's string, not the raw item's — buildPdfText folds CR
            // out, and the span's characters must index the same way the
            // offsets do or per-character highlight math drifts.
            span.textContent = s.str;
            span.dataset.startOffset = String(s.startOffset);
            const spanId = `${idPrefix}-${s.startOffset}`;
            span.id = spanId;
            // role=text + the word's own text content gives the SR an accessible
            // name when this span is the aria-activedescendant (spec §5.1).
            span.setAttribute("role", "text");
            span.style.position = "absolute";
            span.style.whiteSpace = "pre";
            span.style.transformOrigin = "0% 0%";
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - fontHeight}px`;
            span.style.fontSize = `${fontHeight}px`;
            span.style.fontFamily = "sans-serif";
            p.textLayer.appendChild(span);

            spanByOffset.set(s.startOffset, { span, pageIndex });
            spanIdByOffset.set(s.startOffset, spanId);
            toScale.push({ span, target: item.width * p.viewport.scale });
          }
        });

        // Navigable stops: segments that have a span AND aren't whitespace-only,
        // so the cursor steps word-to-word and never lands on an invisible run
        // (spec §3.3/§7). Index order is document/reading order by construction.
        const navStops: number[] = [];
        segments.forEach((s, i) => {
          if (s.str.trim().length > 0 && spanByOffset.has(s.startOffset)) {
            navStops.push(i);
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
          spanIdByOffset,
          navStops,
          pages: rendered.map((p) => ({
            pageWrap: p.pageWrap,
            highlightLayer: p.highlightLayer,
          })),
        };
        drawHighlights(
          renderStateRef.current,
          annotations,
          visibleKinds,
          !readOnly,
          onAnnotationClick
        );
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
    if (s) drawHighlights(s, annotations, visibleKinds, !readOnly, onAnnotationClick);
  }, [annotations, visibleKinds, readOnly, onAnnotationClick]);

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

  // True while a mouse drag is in progress; the mouseup path owns that case so
  // the debounced selectionchange handler stands down (avoids a double-emit).
  const pointerDownRef = useRef(false);
  // Last emitted "start:end" so the same range isn't surfaced twice (e.g. the
  // mouseup commit followed by a trailing selectionchange for the same range,
  // OR the keyboard commit followed by a trailing selectionchange — the
  // keyboard committer sets the window selection, so it MUST funnel through this
  // same de-dupe to avoid a double popover (spec §6)).
  const lastEmittedRef = useRef<string | null>(null);

  // Single emit body shared by the mouse/DOM path (commitSelection) and the
  // keyboard committer (commitKeyboardSelection). Builds the identical
  // SelectionPayload from an already-resolved [start, end) + viewport rect and
  // applies the lastEmittedRef de-dupe. Factored out per spec §3.5/§6 so the
  // keyboard path reuses, not duplicates, the emit.
  const emitSelection = useCallback(
    (start: number, end: number, rect: DOMRect): void => {
      const s = renderStateRef.current;
      if (!s) return;
      const key = `${start}:${end}`;
      if (key === lastEmittedRef.current) return; // already surfaced this range
      lastEmittedRef.current = key;
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
    },
    [onSelection]
  );

  // Read the live DOM selection and surface it as a SelectionPayload. Shared by
  // the mouse path (mouseup) and the keyboard path (debounced selectionchange),
  // so a selection made by ANY means opens the popover identically. The popover
  // button is itself focusable, closing the keyboard create-annotation loop.
  const commitSelection = useCallback(
    (allowCollapsedClick: boolean) => {
      if (readOnly) return;
      const s = renderStateRef.current;
      if (!s) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        lastEmittedRef.current = null;
        onClearSelection?.();
        return;
      }

      if (sel.isCollapsed) {
        // A collapsed click inside a highlight opens it (mouse affordance);
        // keyboard editing goes through the focusable highlight instead.
        if (allowCollapsedClick) {
          const off = offsetFromNode(sel.anchorNode, sel.anchorOffset);
          const hit =
            off === null ? null : annotationAt(annotations, visibleKinds, off);
          if (hit) {
            onAnnotationClick?.(hit);
            return;
          }
        }
        lastEmittedRef.current = null;
        onClearSelection?.();
        return;
      }

      const a1 = offsetFromNode(sel.anchorNode, sel.anchorOffset);
      const a2 = offsetFromNode(sel.focusNode, sel.focusOffset);
      // A selection that doesn't resolve to our text layer (e.g. the user
      // selected something elsewhere on the page) clears the popover.
      if (a1 === null || a2 === null) {
        lastEmittedRef.current = null;
        onClearSelection?.();
        return;
      }
      const start = Math.max(0, Math.min(a1, a2));
      const end = Math.min(s.text.length, Math.max(a1, a2));
      if (end - start < 1) {
        lastEmittedRef.current = null;
        onClearSelection?.();
        return;
      }

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      emitSelection(start, end, rect);
    },
    [
      readOnly,
      annotations,
      visibleKinds,
      onClearSelection,
      onAnnotationClick,
      emitSelection,
    ]
  );

  const handleMouseUp = () => {
    pointerDownRef.current = false;
    commitSelection(true);
  };

  // Keyboard path: surface a selection once it's been stable for a beat. A
  // keyboard selection (shift+arrows, or assistive tech / caret browsing) emits
  // `selectionchange` on every caret nudge with no natural "done" signal, so we
  // debounce. While the mouse is dragging, the mouseup path owns it (we stand
  // down) to avoid a duplicate emit. This is the "debounced stable selection"
  // trigger chosen in design.
  useEffect(() => {
    if (readOnly) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSelChange = () => {
      if (pointerDownRef.current) return; // mouse drag → mouseup will commit
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => commitSelection(false), 350);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("selectionchange", onSelChange);
      if (timer) clearTimeout(timer);
    };
  }, [readOnly, commitSelection]);

  // ---- Keyboard span-navigation selection mode (spec 2026-06-22) -----------
  // The roving cursor is an index into renderState.navStops; anchorNav !== null
  // means a Shift-extended selection is in progress. Both are component state so
  // the cursor render + live announcements react to moves. They reset whenever
  // the document re-renders (status flips away from "ready").
  const [cursorNav, setCursorNav] = useState<number | null>(null);
  const [anchorNav, setAnchorNav] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  // aria-activedescendant id for the focused word (drives SR word-by-word
  // reading without moving real DOM focus off the region).
  const [activeDescId, setActiveDescId] = useState<string | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Reset the cursor whenever a fresh document is (re)rendered or read-only
  // turns the mode off, so stale indices never point into a replaced segments
  // array.
  useEffect(() => {
    if (status !== "ready" || readOnly) {
      setCursorNav(null);
      setAnchorNav(null);
      setActiveDescId(null);
    }
  }, [status, readOnly]);

  // Debounced polite announcement (mirrors the 350 ms philosophy already in the
  // file) so rapid Shift+Arrow doesn't flood the live region.
  const announce = useCallback((msg: string, immediate = false) => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    if (immediate) {
      setLiveMessage(msg);
      return;
    }
    announceTimerRef.current = setTimeout(() => setLiveMessage(msg), 200);
  }, []);

  // Reflect the cursor in the DOM: scroll the active span into view and point
  // aria-activedescendant at it. Pure side-effect of cursor state; no layout on
  // the hot path beyond scrollIntoView (spec §4).
  useEffect(() => {
    const s = renderStateRef.current;
    if (!s || cursorNav === null) {
      setActiveDescId(null);
      return;
    }
    const offset = s.segments[s.navStops[cursorNav]]?.startOffset;
    if (offset === undefined) return;
    const id = s.spanIdByOffset.get(offset) ?? null;
    setActiveDescId(id);
    const info = s.spanByOffset.get(offset);
    info?.span.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursorNav]);

  // Draw the transient selection "marquee" — a dashed outline over the spanned
  // words, distinct from committed-annotation tints (never a kind color) so it
  // isn't mistaken for a saved highlight (spec §3.4). Declared AFTER the
  // highlights effect so it re-runs (and redraws) whenever drawHighlights wipes
  // the layer; depends on annotations/visibleKinds for exactly that reason.
  useEffect(() => {
    const s = renderStateRef.current;
    if (!s) return;
    // Clear any prior marquee chrome first (highlights own the rest of the layer).
    for (const p of s.pages) {
      for (const el of Array.from(
        p.highlightLayer.querySelectorAll(`[${MARQUEE_ATTR}]`)
      )) {
        el.remove();
      }
    }
    if (readOnly || cursorNav === null) return;

    // The marquee covers the inclusive nav range [min, max]; a lone cursor
    // (no anchor) gets a single-word outline so the focus position is visible
    // (spec §2.4.7 focus visible).
    const a = anchorNav ?? cursorNav;
    const lo = Math.min(a, cursorNav);
    const hi = Math.max(a, cursorNav);
    const loSeg = s.segments[s.navStops[lo]];
    const hiSeg = s.segments[s.navStops[hi]];
    if (!loSeg || !hiSeg) return;
    const start = loSeg.startOffset;
    const end = hiSeg.endOffset;

    const covered = itemsCoveringRange(s.segments, start, end);
    for (const { item, fromChar, toChar } of covered) {
      const info = s.spanByOffset.get(item.startOffset);
      const textNode = info?.span.firstChild;
      if (!info || !textNode) continue;
      const range = document.createRange();
      try {
        range.setStart(textNode, fromChar);
        range.setEnd(textNode, toChar);
      } catch {
        continue;
      }
      const page = s.pages[info.pageIndex];
      const wrap = page.pageWrap.getBoundingClientRect();
      for (const r of Array.from(range.getClientRects())) {
        const div = document.createElement("div");
        div.setAttribute(MARQUEE_ATTR, "");
        div.style.position = "absolute";
        div.style.left = `${r.left - wrap.left}px`;
        div.style.top = `${r.top - wrap.top}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        div.style.borderRadius = "2px";
        // Dashed sky outline — a shape cue, not a kind tint (CLAUDE.md §9).
        div.className =
          "outline-dashed outline-2 outline-offset-1 outline-sky-600 bg-sky-200/30";
        page.highlightLayer.appendChild(div);
      }
    }
    // annotations/visibleKinds are deps so this redraws after drawHighlights
    // wipes the layer; readOnly toggles the mode off.
  }, [cursorNav, anchorNav, readOnly, annotations, visibleKinds, status]);

  // Commit the current keyboard selection: synthesize a DOM Range over the
  // spanned offsets, set it as the window selection (so the artifact a keyboard
  // user creates is identical to the mouse one), and route through the SHARED
  // emitSelection. The lastEmittedRef de-dupe guards the trailing
  // selectionchange that setting the window selection will fire (spec §3.5/§6).
  const commitKeyboardSelection = useCallback((): boolean => {
    if (readOnly) return false;
    const s = renderStateRef.current;
    if (cursorNav === null) return false;
    const a = anchorNav ?? cursorNav;
    const lo = Math.min(a, cursorNav);
    const hi = Math.max(a, cursorNav);
    if (!s) return false;
    const loSeg = s.segments[s.navStops[lo]];
    const hiSeg = s.segments[s.navStops[hi]];
    if (!loSeg || !hiSeg) return false;
    const start = Math.max(0, loSeg.startOffset);
    const end = Math.min(s.text.length, hiSeg.endOffset);
    if (end - start < 1) return false;

    const startInfo = s.spanByOffset.get(loSeg.startOffset);
    const endInfo = s.spanByOffset.get(hiSeg.startOffset);
    const startNode = startInfo?.span.firstChild;
    const endNode = endInfo?.span.firstChild;
    if (!startNode || !endNode) return false;

    const range = document.createRange();
    try {
      range.setStart(startNode, 0);
      range.setEnd(endNode, hiSeg.str.length);
    } catch {
      return false;
    }
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // End-anchored rect: for a cross-page range the union would span the gutter
    // and push the popover off-screen, so anchor to the cursor end (spec §7).
    const rects = range.getClientRects();
    const rect =
      rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
    emitSelection(start, end, rect);
    return true;
  }, [readOnly, cursorNav, anchorNav, emitSelection]);

  // The whole keyboard model on one handler bound to the region. Returns early
  // for non-handled keys so the browser's defaults (e.g. Tab to leave) survive.
  const handleRegionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return;
      const s = renderStateRef.current;
      if (!s || s.navStops.length === 0) return;

      // First entry / focus may not have seated a cursor yet.
      const start = cursorNav ?? 0;
      const wordLabel = (navIdx: number): string =>
        s.segments[s.navStops[navIdx]]?.str.trim() ?? "";

      const move = (intent: NavIntent, extend: boolean): void => {
        e.preventDefault();
        const next = navigate(s.segments, s.navStops, start, intent);
        if (extend) {
          // Begin (or continue) extending: set the anchor to where we started
          // if we weren't already extending.
          setAnchorNav((prev) => (prev === null ? start : prev));
        } else {
          setAnchorNav(null); // plain arrow collapses to a single-word cursor
        }
        setCursorNav(next);
        if (extend) {
          const a = anchorNav ?? start;
          const lo = Math.min(a, next);
          const hi = Math.max(a, next);
          const count = hi - lo + 1;
          announce(
            `Selected: ${wordLabel(lo)} … ${wordLabel(hi)}, ${count} word${count === 1 ? "" : "s"}.`
          );
        }
        // Word-by-word reading is carried by aria-activedescendant; the live
        // region stays quiet on plain moves to avoid double-speak (spec §5.2).
      };

      switch (e.key) {
        case "ArrowRight":
          move("word-next", e.shiftKey);
          return;
        case "ArrowLeft":
          move("word-prev", e.shiftKey);
          return;
        case "ArrowDown":
          move("line-next", e.shiftKey);
          return;
        case "ArrowUp":
          move("line-prev", e.shiftKey);
          return;
        case "Home":
          move(e.ctrlKey ? "doc-home" : "line-home", e.shiftKey);
          return;
        case "End":
          move(e.ctrlKey ? "doc-end" : "line-end", e.shiftKey);
          return;
        case "Enter": {
          e.preventDefault();
          if (commitKeyboardSelection()) {
            announce("Annotation menu open. Press Enter to choose a kind.", true);
            // The popover mounts on the parent's next render in response to
            // onSelection; move focus to its Annotate button once it exists
            // (it lives in a sibling component, reachable only by query here).
            const focusPopover = (attempt: number): void => {
              const btn = document.querySelector<HTMLButtonElement>(
                '[role="toolbar"][aria-label="Annotation toolbar"] button'
              );
              if (btn) {
                btn.focus();
              } else if (attempt < 10) {
                requestAnimationFrame(() => focusPopover(attempt + 1));
              }
            };
            requestAnimationFrame(() => focusPopover(0));
          }
          return;
        }
        case "Escape": {
          e.preventDefault();
          if (anchorNav !== null) {
            // In-progress selection → collapse to the cursor, stay in mode.
            setAnchorNav(null);
            lastEmittedRef.current = null;
            onClearSelection?.();
            window.getSelection()?.removeAllRanges();
            announce("Selection cleared.", true);
          } else {
            // No selection → exit the mode (focus stays on the region; a second
            // Tab leaves the layer entirely).
            setCursorNav(null);
            setActiveDescId(null);
            announce("Left selection mode.", true);
          }
          return;
        }
        default:
          return; // let unhandled keys (Tab, etc.) behave natively
      }
    },
    [readOnly, cursorNav, anchorNav, announce, commitKeyboardSelection, onClearSelection]
  );

  // On focus, seat the cursor on the first navigable word (first entry) and
  // announce the mode once.
  const handleRegionFocus = useCallback(() => {
    if (readOnly) return;
    const s = renderStateRef.current;
    if (!s || s.navStops.length === 0) return;
    setCursorNav((prev) => (prev === null ? 0 : prev));
    announce(
      "Selection mode. Use arrows to move by word, Shift and arrow to select, Enter to annotate, Escape to exit.",
      true
    );
  }, [readOnly, announce]);

  useEffect(
    () => () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    },
    []
  );

  // The managed text region is a single tab stop only when there's a navigable
  // text layer and creation is allowed. role="application" so the SR's own caret
  // doesn't intercept our remapped Arrow/Shift/Enter keys (spec §5.1).
  const kbdMode = status === "ready" && !readOnly;
  const regionLabel = useMemo(
    () =>
      "Source text — press arrow keys to move by word, Shift and arrow to select, Enter to annotate, Escape to exit.",
    []
  );

  return (
    <div className="space-y-2">
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading PDF…
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
        onMouseDown={() => {
          pointerDownRef.current = true;
        }}
        onMouseUp={handleMouseUp}
        // Keyboard create mode: a single tab stop owning the whole text layer.
        // role="application" remaps Arrow/Shift/Enter to our selection model
        // (spec §5.1). Only active when there's navigable text and creation is
        // allowed; otherwise the region is inert (readOnly / scanned / error).
        tabIndex={kbdMode ? 0 : undefined}
        role={kbdMode ? "application" : undefined}
        aria-label={kbdMode ? regionLabel : undefined}
        aria-activedescendant={kbdMode && activeDescId ? activeDescId : undefined}
        onFocus={kbdMode ? handleRegionFocus : undefined}
        onKeyDown={kbdMode ? handleRegionKeyDown : undefined}
        className="space-y-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-100 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      />
      {/* Polite live region: mode entry, selection extent, commit, cancel/exit
          (spec §5.2). Word-by-word reading is carried by aria-activedescendant. */}
      <div aria-live="polite" className="sr-only" role="status">
        {liveMessage}
      </div>
    </div>
  );
}
