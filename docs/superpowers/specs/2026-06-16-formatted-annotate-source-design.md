# Formatted Source on the Reading & Annotation Step — Design

> **Status:** Design approved 2026-06-16. Implements the "rich mode" annotation
> render that `docs/SOURCE_TEXT_ARCHITECTURE.md` §6 Chunk 2 left deferred (lines
> 141–142). Scope: **rich mode only** (typed/pasted + `.docx`). PDF-native
> annotation (`pdfjs-dist`) remains deferred and out of scope here.

---

## 1. Problem

On the student Reading & Annotation step (e.g. Expository → Reading &
Annotation), the source document renders as flat plain text
(`source-text-viewer.tsx`, `whitespace-pre-wrap` over the `source_text` string).
Headings, paragraphs, lists, and tables that the teacher's source contains are
lost. The source **must render with its formatting** — headings, paragraphs,
tables, lists, blockquotes, links, and images — while annotation continues to
work exactly as it does today.

## 2. Why this is safe — the offset invariant

Annotations are character offsets (`text_annotations.range_start / range_end`)
into the assignment's `source_text`. The architecture's locked invariant is:

> `source_text` is the exact `textContent` projection of the sanitized
> `source_html` (`buildSourceColumns` → `sourceHtmlToSubstrate`, which uses
> jsdom `body.textContent` — no whitespace collapse, no injected newlines).

The annotate viewer's selection→offset mapper (`getAbsoluteOffset`) walks the
container's text nodes via `TreeWalker(SHOW_TEXT)` in document order, summing
lengths. That traversal order is **identical** to the `textContent` projection
order. Therefore rendering `source_html` as real DOM — instead of the flat
string — keeps every offset valid, character-for-character.

Elements introduced by this change do not perturb the invariant:
- **Images** contribute zero characters to `textContent`.
- **Links / blockquotes / headings / list items / table cells** contribute their
  text in document order, exactly as `textContent` concatenates them.

The `text_annotations` table, its RLS, and all saved annotation rows are
**untouched**.

## 3. Approach (decided)

**Render the stored sanitized `source_html` as formatted DOM** on the annotate
surface (rejected alternative: annotating directly on the pixel-faithful
docx-preview render — its fixed-layout/absolutely-positioned DOM makes
offset mapping fragile, the same class of problem as PDF.js, with high risk to
annotation correctness).

The result is *formatted and faithful to structure* (headings, paragraphs,
tables, lists) but **not pixel-identical to Word** (no original fonts/page
geometry). Exact fidelity remains available via the existing "Open original"
button on every surface.

## 4. Architecture

The change is contained to the shared `SourceTextViewer` component plus prop
plumbing. The annotation engine, server actions, queries' shape, and schema are
unchanged.

`SourceTextViewer` gains an optional `sourceHtml?: string | null` prop and
branches on its **presence** (non-null only for rich mode — no separate
`renderMode` prop needed):

- **`sourceHtml` present → rich render** (new code path).
- **`sourceHtml` absent → flat render** (existing `buildSegments` path,
  unchanged — covers `plain` and `pdf`-fallback sources, so no regression).

## 5. The rich renderer

When `sourceHtml` is present, `SourceTextViewer`:

1. Parses `sourceHtml` once via `DOMParser` into a detached DOM tree.
2. Walks the tree in document order, maintaining a running character offset
   (the same accounting `sourceHtmlToSubstrate` performs). For each **text
   node**, it slices the node against the visible annotation ranges and wraps
   covered slices in `<mark>` (carrying `data-annotation-id`, the kind's
   highlight class, click handler, and title — identical to the flat path). An
   annotation spanning, e.g., the end of an `<h2>` into the next `<p>` becomes
   **two `<mark>`s**, one inside each element. Only text nodes are split;
   element structure is rebuilt as React elements.
3. Renders the resulting React tree inside the same `containerRef`. Selection
   detection (`handleMouseUp` → `getAbsoluteOffset`) is unchanged and correct
   because the container's `SHOW_TEXT` walk matches the projection order. The
   `readOnly` flag suppresses selection + mark clicks exactly as today.

**First-wins overlap** semantics (sort by `range_start`, earlier annotation wins
the overlap, later one's start is clipped) carry over from the existing
`buildSegments` algorithm.

**Styling:** rich mode drops `whitespace-pre-wrap` (block elements supply
structure) and applies a scoped `.source-rich` prose stylesheet in
`globals.css` (heading sizes, list indents, bordered/striped tables, blockquote
rule, constrained inline images) — mirroring the existing `.source-doc` styles.

**Element/text-node rebuild detail:** the renderer must preserve every text node
the parser produces, including inter-tag whitespace text nodes, so the rendered
container's `textContent` equals the stored `source_text` byte-for-byte. The
walk rebuilds element nodes (tag + recursing children) and splits only text
nodes; it does not normalize or trim.

## 6. Sanitizer allowlist changes (`lib/source-content.ts`)

`ALLOWED_TAGS` expands:

```
existing: p, br, strong, em, u, h2, h3, ul, ol, li
add:      h1, h4, h5, h6, blockquote,
          a, img,
          table, thead, tbody, tfoot, tr, td, th, caption
```

`ALLOWED_ATTR` (currently `[]`) gains a minimal, safe set:
- `href`, `target`, `rel` on `<a>`. DOMPurify neutralizes `javascript:` URLs;
  a DOMPurify `afterSanitizeAttributes` hook forces `target="_blank"` and
  `rel="noopener noreferrer"` on every surviving anchor.
- `src`, `alt` on `<img>`, with `src` restricted to `data:` (mammoth's inline
  encoding) and `https:` schemes.
- No `style`, `class`, `id`, or event-handler attributes anywhere.

**Invariant preserved automatically:** `source_text` is derived by
`sourceHtmlToSubstrate` (`body.textContent`) over the sanitized HTML, so adding
tags stays consistent with the substrate at save time with no extra logic. The
contract test (`source-content.test.ts`) that asserts no injected newlines
continues to hold.

## 7. Data plumbing

`source_html` is already fetched in `getWriting` (`student-writings.ts` selects
`source_render_mode, source_html`); it is simply not threaded to the viewer.
Add one optional prop at each hop:

- **Annotate step:** `app/student/writings/[id]/[step]/page.tsx` →
  `AnnotateTextStep` (`_steps/annotate-text-step.tsx`) → `AnnotateTextClient`
  (`annotate-text-client.tsx`) → `SourceTextViewer`.
- **Reference panels:** the six downstream step clients —
  `t-chart-client`, `gather-cds-client`, `cm-dev-client`, `decisions-client`,
  `elaboration-client`, `tsd-client` — each receive `sourceHtml` from their
  `_steps/*` server wrapper and pass it to `ReferencePanel` (invoked twice per
  client for responsive mobile/desktop layouts) → `SourceTextViewer`.

Each hop is a one-line prop addition; no logic changes in the intermediate
components.

## 8. Scope

- **In scope:** rich-mode formatted rendering on the annotate step **and** all
  downstream read-only reference panels (shared component → both benefit).
- **Out of scope:** PDF-native annotation (`pdfjs-dist`, still deferred per the
  architecture doc); the teacher combined-review surface (Chunk 3 — a later
  pass can reuse this renderer); any backfill of existing assignments.

## 9. Data caveat (operational, not code)

Existing rich assignments were sanitized under the **old** allowlist, so their
stored `source_html` / `source_text` already had tables, images, and links
stripped at save time. They will render with whatever survived. To recover
tables/images/links, the teacher must **re-save (re-upload)** that assignment;
new uploads carry everything. No backfill script is planned unless requested.

## 10. Testing

- **Unit — alignment (critical):** for HTML containing headings, nested lists, a
  table, a blockquote, a link, and an image, assert the rich renderer's
  text-node concatenation equals `source_text`. This proves offset alignment.
- **Unit — cross-boundary marks:** an annotation range spanning a
  heading→paragraph boundary produces a `<mark>` inside **both** elements,
  covering exactly the intended characters; first-wins overlap is preserved.
- **Sanitizer:** extend `source-content.test.ts` — the new allowlist tags
  survive sanitization; `<a>`/`<img>` keep only the allowed attributes;
  `javascript:` and non-`data:`/`https:` `src` are dropped; the substrate
  projection stays newline-free.
- **Component:** the annotate viewer renders a `<table>` and `<h2>`; a selection
  across a heading→paragraph boundary yields the correct `[start, end]` via
  `getAbsoluteOffset`.

## 11. Files touched (summary)

| File | Change |
|---|---|
| `lib/source-content.ts` | Expand `ALLOWED_TAGS` / `ALLOWED_ATTR`; URL + rel hardening |
| `components/student/writing/source-text-viewer.tsx` | Add `sourceHtml` prop + rich render path (DOMParser walk, cross-boundary `<mark>`) |
| `app/globals.css` | Add scoped `.source-rich` prose styles |
| `app/student/writings/[id]/[step]/page.tsx` | Pass `sourceHtml` to `AnnotateTextStep` |
| `app/student/writings/[id]/_steps/annotate-text-step.tsx` | Thread `sourceHtml` |
| `components/student/writing/annotate-text-client.tsx` | Thread `sourceHtml` |
| `components/student/writing/reference-panel.tsx` | Add `sourceHtml` prop → viewer |
| 6× `_steps/*` + 6× `*-client.tsx` (t-chart, gather-cds, cm-dev, decisions, elaboration, tsd) | Thread `sourceHtml` to `ReferencePanel` |
| `__tests__/lib/source-content.test.ts` | Extend allowlist + projection tests |
| `__tests__/` (new) | Rich-renderer alignment + cross-boundary mark tests |
