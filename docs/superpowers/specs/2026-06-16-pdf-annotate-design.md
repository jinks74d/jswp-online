# Faithful PDF on the Read & Annotate Step — Design

> **Status:** Design approved 2026-06-16 (§1–5). Implements the
> `docs/SOURCE_TEXT_ARCHITECTURE.md` Chunk 2 **PDF-native** annotation that was
> deferred as "the genuinely hard part" (needs `pdfjs-dist`). The rich-mode
> (`.docx`/typed) annotate render shipped 2026-06-16
> (`2026-06-16-formatted-annotate-source-design.md`); this is the PDF sibling.

---

## 1. Problem

On the student Read & Annotate step, a PDF source currently renders as flat
extracted text (`unpdf` output) — unreadable and unfaithful. The teacher's PDF
must **appear in its original formatting** on the annotate step *and* remain
**annotatable** (highlight evidence with the five JSWP annotation kinds), since
highlighting is the entire purpose of the step.

A prerequisite — archiving the uploaded file at create time — was fixed
separately (commit `24a038e`); without a stored file there is nothing to render.

## 2. Approach (decided): pdf.js as the single source of truth

Annotations are character offsets (`text_annotations.range_start/range_end`)
into `source_text`. For the text layer to be annotatable, its characters must
line up with `source_text` exactly. We guarantee that by the architecture's
locked principle:

> **`source_text` is produced by the same pipeline that renders it.**

A single function turns pdf.js `getTextContent()` items into *both* the stored
`source_text` and the on-screen text layer, so a selection maps to a stable
offset **by construction** — no fuzzy alignment.

Rejected: (Approach 2) keep `unpdf` text and reconcile the pdf.js text layer to
it via fuzzy matching — the spacing/ordering fragility the arch doc flags as the
top risk. **Approach 3** (degrade to rich-HTML/extracted-text annotation if
pdf.js proves unreliable) is retained as the live *fallback*, not the target.

`pdfjs-dist` is pre-approved (CLAUDE.md §15 / architecture doc deps table). The
`text_annotations` table, its RLS, and the annotation engine are **unchanged**.

## 3. Architecture & reuse

A **third renderer** alongside the flat (`SourceTextViewer`) and rich
(`rich-source-tree`/`rich-source-body`) ones. It emits the same
`SelectionPayload` and consumes the same annotation rows, so the popover, form,
sidebar, Continue gate, and server actions are reused unchanged.

New units:
- **`lib/pdf-text.ts`** (pure) — the canonical text function (see §4).
- **`components/student/writing/pdf-source-viewer.tsx`** (`"use client"`) — the
  canvas + text-layer + selection + highlight renderer (see §5).
- **`lib/pdf-worker.ts`** (or equivalent) — one-time pdf.js worker configuration
  for Next.js.

## 4. The canonical text function (`lib/pdf-text.ts`) — offset-consistency core

```
buildPdfText(pages: PdfPageItems[]): { text: string; items: PositionedItem[] }
```

- `PositionedItem = { str, pageIndex, bbox, startOffset, endOffset }`.
- `text` = in-order concatenation of every item's `str` plus a **deterministic
  separator rule**: insert a space when the horizontal gap between adjacent
  same-line items exceeds a threshold; a newline on `hasEOL`; a page break
  between pages. This rule lives **only here**.
- `startOffset/endOffset` record exactly where each item's text sits in `text`,
  including separators, so offsets tile `text` with no gaps or overlaps.

Used in two places, guaranteeing identical character sequences:
- **At upload** — its `text` becomes `source_text`.
- **At render** — its `items` drive the text-layer spans and the offset↔highlight
  mapping.

Pure and fully unit-testable (synthetic items in, assert `text` + offsets). The
separator rule is the **highest-risk** piece, so tests concentrate there.

## 5. The PDF render/annotate viewer (`PdfSourceViewer`)

Props mirror `SourceTextViewer` (`sourceText`, `annotations`, `visibleKinds`,
`scrollToAnnotationId`, `onSelection`, `onClearSelection`, `onAnnotationClick`,
`readOnly`) plus a server-minted **signed URL** for the PDF.

On mount (client-only — pdf.js uses browser APIs; mount-gate to avoid a
hydration mismatch, as the rich renderer does):
1. Load pdf.js (worker configured once), fetch the PDF.
2. Per page: render to a `<canvas>` (visual fidelity) and run `getTextContent()`
   → feed `buildPdfText` to accumulate `items` live. Because it's the same
   function used at upload, offsets match `source_text` — nothing persisted
   beyond `source_text`.
3. Build a transparent **text layer** of absolutely-positioned spans over the
   canvas, one per item, each tagged with its `startOffset`.

Then:
- **selection → offset:** on mouseup, map the DOM selection's anchor/focus spans
  to `item.startOffset + localOffset`; emit `SelectionPayload` (with the
  selection's bounding rect for popover placement).
- **offset → highlight:** for each visible annotation, find items intersecting
  `[range_start, range_end)` and draw kind-colored overlay divs at their `bbox`;
  click → `onAnnotationClick`.
- `readOnly`: render highlights, disable selection (reference panels; future
  teacher review).

**Plumbing:** the annotate step page mints the signed URL server-side (as the
assignment-detail page already does) and passes it down; `AnnotateTextClient`
(and `ReferencePanel`) branch to `PdfSourceViewer` when
`source_render_mode === 'pdf'` and a file exists, else the flat/rich path.

**Performance:** v1 renders all pages (source readings are typically a few
pages); page virtualization is a noted future optimization, logged rather than
hidden.

## 6. Error handling + the Approach-3 fallback

Annotation correctness never depends on pdf.js succeeding:
- **pdf.js load / worker / fetch failure, or expired signed URL** → fall back to
  `SourceTextViewer` over the same `source_text` (annotatable; highlights still
  align) + an "Open original" button + a small notice. This is Approach 3 as the
  live degrade path.
- **Scanned/image PDF with no text layer** (`buildPdfText` yields empty `text`)
  → render the canvas read-only for viewing + a clear "this PDF has no
  selectable text" notice + "Open original". Annotation is impossible on a pure
  image — surfaced, not silently broken.
- **Signed URL expiry mid-session:** the canvas renders once at load while the
  URL is fresh; mint with a render-appropriate expiry; a stale reload hits the
  fallback. Known edge, not a blocker.

## 7. Testing strategy

Risk concentrates in the pure text/offset layer, so tests do too:
- **`buildPdfText` (unit, primary):** synthetic pdf.js items → assert `text` and
  each item's `startOffset/endOffset`; dedicated cases for the separator rule
  (gap→space, `hasEOL`→newline, page breaks) and contiguity (offsets tile `text`).
- **Mapping helpers (unit):** offset-range → covered items; span+localOffset →
  global offset.
- **`PdfSourceViewer` (browser-verified):** canvas rendering + real-PDF
  `getTextContent` + DOM selection don't run meaningfully under jsdom, so the
  viewer integration is verified in the browser (select → highlight at correct
  spot → persist → reload), including the scanned-PDF and fallback paths. No
  fabricated jsdom test that doesn't exercise the real path.

## 8. Build sequence (phased)

| Phase | Goal | Agent | Risk / verify |
|---|---|---|---|
| 0 | Add `pdfjs-dist` + configure the worker for Next App Router; render one page to canvas in dev | jswp-frontend | Worker config in Next is fiddly — browser-verify |
| 1 | `lib/pdf-text.ts` — `buildPdfText` + separator rule | jswp-frontend | **Highest risk** = separator heuristic; TDD-concentrate; offsets tile contiguously |
| 2 | Switch PDF extraction `unpdf`→`pdfjs-dist` via `buildPdfText`; store `text` as `source_text` | jswp-backend | Forward-only (existing PDFs re-upload); dynamic-import to keep bundle lean |
| 3 | `PdfSourceViewer` display slice — canvas + transparent text layer, no annotation | jswp-frontend | SSR/hydration (mount-gate pdf.js); render-all-pages cap noted |
| 4 | selection→offset + highlight overlays by kind; `readOnly` variant | jswp-frontend | Unit-test pure mapping; viewer browser-verified |
| 5 | Branch `AnnotateTextClient` + step page mints signed URL + reference panels | jswp-frontend + jswp-backend | Full annotate flow on a PDF |
| 6 | Fallbacks: failure → flat path + Open original; scanned PDF → read-only + notice | jswp-frontend | Annotation never depends on pdf.js |
| 7 | Independent review (offset invariant, fallback, keyboard a11y) | jswp-reviewer + ux-design-specialist | **Canvas text-layer keyboard accessibility** is a real concern |

**No `jswp-database` work** — `text_annotations`/RLS unchanged; no migration.
Only approval gate (`pdfjs-dist`) is already cleared.

## 9. Data reality (operational)

Per the live-DB check (architecture doc, 2026-06-16), no existing assignment
has a stored source file — the one PDF predates file persistence. So this
feature applies to assignments **re-uploaded** after the create-time archival
fix (`24a038e`); there is no PDF to backfill.

## 10. Accessibility note

A canvas + transparent-text-layer selection model is mouse-native; **keyboard
selection of evidence on a PDF** is a genuine open concern (the text path
supports keyboard selection naturally; a canvas overlay does not). Phase 7
includes a `ux-design-specialist` pass; if keyboard selection can't be made
workable on the text layer, the documented fallback (annotate the extracted
text, read the PDF) is the accessible path, and that tension must be resolved
before calling this WCAG-AA complete (CLAUDE.md §9).

## 11. Out of scope

- Teacher review rendering of PDF annotations (Chunk 3 — reuses `PdfSourceViewer`
  `readOnly` later).
- Page virtualization for very long PDFs (noted optimization).
- Cite-by-paragraph-number / "Finding the Main Idea" sheet (deferred to the
  p.52–53 walkthrough).
