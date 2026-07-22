# Source Text Architecture — Structured / Rich / PDF-native Source

> **Status:** Design locked 2026-05-31. Chunk 1 built 2026-06-01 (migration
> 0025). **Multi-source cutover 2026-07-22 (migrations 0040 + 0041) — see
> Section 0, which supersedes the single-substrate parts of this document.**
> **Provenance:** Driven by the Expository walkthrough against the 2024 guide,
> pp. 48–57 (the *Scientific American* / Carol Dweck "Two Views of Intelligence"
> summary example). Supersedes the earlier "normalized `source_paragraphs` /
> `source_vocabulary` tables" plan (audited then dropped when the requirement
> became *render the artifact faithfully*, not re-store its structure).

---

## 0. Multi-source update (2026-07-22) — supersedes single-substrate assumptions

Assignments now carry **many** sources instead of one. The offset invariant is
unchanged in spirit — annotations are still character offsets into a substrate —
but the substrate is now **per source**, and each annotation records *which*
source it indexes.

**Schema.** A child table `assignment_sources` (migration 0040) holds one row
per source, each with the full source column set (`source_text`, `source_html`,
`source_render_mode`, `source_file_*`, `source_title/author/citation/url`) plus
`position` and a `kind` of `'primary' | 'secondary'`. `text_annotations` gains a
nullable `source_id` FK. Migration 0041 **drops the legacy
`assignments.source_*` columns** — they no longer exist; read sources from
`assignment_sources`.

**Offsets.** Each source keeps its own `source_text` substrate produced by the
same pipeline that renders it (the Section 1 rule, now applied per source).
`range_start / range_end` index the substrate of the source named by
`source_id`. Rendering runs the two renderer functions once per source with that
source's annotation subset.

**RLS.** `assignment_sources` no longer rides the `assignments` policies (it is
its own table). Two `SECURITY DEFINER` helpers —
`auth_user_can_read_assignment` / `auth_user_can_write_assignment` — mirror the
assignment visibility rules (teacher-owner, co-teacher, in-scope admin, and —
read only — an enrolled student once released). The `assignment-sources` storage
bucket is unchanged; files are cleaned up on source removal / assignment delete.

**Step visibility.** "Has a source" is now "has ≥ 1 `assignment_sources` row"
(a `count` embed), not `source_text IS NOT NULL`.

The sections below describe the original single-source design; treat any
reference to `assignments.source_*` columns or "one substrate per assignment" as
historical — the mechanics (pipeline-produced substrate, two renderer
functions, school-scoped bucket) still hold, now per source.

---

## 1. The core principle — one substrate, two renderers

Annotations never change shape: they remain character offsets
(`text_annotations.range_start / range_end`) into the assignment's
**`source_text`** (a plain string). What changes is *how the source is shown*.

The rule that keeps offsets valid across display modes:

> **`source_text` is produced by the same pipeline that renders it.**

- **PDF** → PDF.js `getTextContent()` produces *both* the canonical `source_text`
  *and* the on-screen text layer. Same ordering ⇒ a text-layer selection maps to
  a stable global offset.
- **Rich / HTML** → `source_text` is the exact `textContent` projection of the
  sanitized `source_html`. The existing `TreeWalker(SHOW_TEXT)` mapper already
  walks text nodes, so it extends to rich HTML unchanged.

Each renderer implements exactly two functions:
1. `selection → [start, end]` (offsets into `source_text`)
2. `[start, end] → visual highlight`

The `text_annotations` table and its RLS are **untouched**.

---

## 2. Display modes (driven by file type)

`assignments.source_render_mode ∈ { 'pdf', 'rich', 'plain' }`

| Mode | Source | Display | Annotation surface |
|---|---|---|---|
| `pdf` | uploaded PDF | PDF.js canvas + text layer | text-layer selection → offset |
| `rich` | `.txt` / `.docx` / paste | sanitized `source_html` in DOM | TreeWalker selection → offset |
| `plain` | legacy / no formatting | today's `whitespace-pre-wrap` | unchanged |

"Open original" (the stored file) is available in **all** modes — a short-lived
signed URL opened in a new tab (no dependency).

---

## 3. Schema — migration 0025 (columns only, no new tables)

The artifact (PDF or rich HTML) carries its own structure — headings, bold,
paragraph numbers, vocabulary box — so **no `source_paragraphs` /
`source_vocabulary` tables.**

```sql
ALTER TABLE assignments
  ADD COLUMN source_file_path   TEXT,
  ADD COLUMN source_file_name   TEXT,
  ADD COLUMN source_file_mime   TEXT,
  ADD COLUMN source_html        TEXT,          -- sanitized; rich mode only
  ADD COLUMN source_render_mode TEXT
    CHECK (source_render_mode IN ('pdf','rich','plain'));
-- source_text retained = canonical annotation substrate (plain projection)
```

No new RLS — these ride the existing `assignments` policies. The uploaded file
rides the existing **school-scoped** `assignment-sources` bucket.

---

## 4. Storage & security

- `assignment-sources` bucket already exists (private, 20 MB, allows
  `application/pdf`, `.docx`, `text/plain`, images). Upload already happens
  best-effort on edit; **Chunk 1 persists the resulting path** onto the
  assignment.
- Bucket **read is school-scoped** (`school-{uuid}/` prefix vs
  `auth_user_school_id()`) — no cross-tenant leak. Known minor over-permission:
  a student can read a schoolmate assignment's source they aren't assigned.
  *Optional later tightening to class scope; acceptable for v1.*
- "Open original" → short-lived signed URL.

---

## 5. Dependencies (approved 2026-05-31, CLAUDE.md §15)

| Dep | Purpose | Chunk |
|---|---|---|
| `pdfjs-dist` | PDF render + text-layer annotation | 2 (student), 3 (teacher review) |
| `mammoth` | `.docx` → text for the annotation substrate (`source_text`) | 1 |
| `docx-preview` | faithful `.docx` *display* (images/tables/fonts/layout) | 2 display slice (approved 2026-06-12) |
| *(none)* | rich-text editor = minimal `contentEditable`, reusing `sanitizeExemplarHtml` | 1 |

Already present and reused: `unpdf` (PDF→text), `dompurify` + `jsdom`
(`sanitizeExemplarHtml`, `htmlToPlainText`).

---

## 6. Build sequence

### Chunk 1 — Teacher source layer (schema + authoring) — ✅ DONE (2026-06-01)
- Migration 0025 (columns above).
- Upload (PDF / `.docx` / `.txt`) → store file, **persist path/name/mime**.
- Extract `source_text`: PDF via `unpdf`; `.docx` via `mammoth` (+ `htmlToPlainText`); `.txt`/paste direct.
- Set `source_render_mode` by type (`pdf` | `rich` | `plain`).
- `source_html` for rich modes (sanitized via `sanitizeExemplarHtml`).
- Minimal `contentEditable` editor (headings / bold / lists) for non-PDF body.
- **"Open original"** button (signed URL → new tab).
- **Contract test:** for rich mode, `source_text` is a pure `textContent`
  projection of `source_html` — *no injected newlines* (offsets must align).

### Chunk 2 — Student render + annotation — *the hard one; needs `pdfjs-dist`*

**Display-only slice — ✅ DONE (2026-06-12).** Students now *see* the formatted
source (they previously only ever saw the flattened `source_text`):
- `SourceDocViewer` (`components/student/writing/source-doc-viewer.tsx`,
  display-only, server-renderable): `pdf` → inline signed-URL `<iframe>`
  (pixel-perfect) + "Open original"; `rich` + **`.docx` file** → `DocxViewer`
  (docx-preview: faithful images/tables/headings/fonts/page layout); `rich`
  typed/pasted (no file) → sanitized `source_html` (`.source-doc` styles);
  `plain` → unchanged. Falls back to plain text if the file/html is missing.
  **The doc "appears as the original"** — the requirement that drove the
  docx-preview addition. `mammoth` output is now used *only* as the annotation
  substrate, not for display.
- Wired into student **assignment-detail** (signed URL minted server-side).
- Annotate step + all downstream **reference panels** keep the plain
  highlightable `SourceTextViewer` as the annotation substrate (no highlight
  regression) and gain an **"Open original"** button
  (`OpenOriginalButton` → `getWritingSourceUrl` mints a fresh signed URL on
  click). `source_render_mode/html/file_path/file_name` added to `getWriting`,
  `getWritingForTeacherReview`, and `getStudentAssignmentDetail`.

**Rich-mode annotation render — ✅ DONE (2026-06-16).** The annotate step + all
downstream reference panels now render `source_html` *formatted* (headings,
paragraphs, lists, tables, blockquotes, links, images) instead of flat text,
with annotation highlights wrapped **across element boundaries**:
- `rich-source-tree.ts` (pure, unit-tested): parses `source_html`, splits text
  nodes into marked/unmarked runs at annotation boundaries, first-wins overlap,
  kind filtering, render-safe attr allowlist. Concatenated run text === the
  `textContent` projection === `source_text`, so offsets never move.
- `rich-source-body.tsx`: maps the tree to React, delegating `<mark>` back to
  `SourceTextViewer` so flat/rich highlights are identical.
- `SourceTextViewer` keys off `sourceHtml` presence; the build is mount-gated
  (DOMParser is browser-only; SSR shows the flat substrate, then formatting
  swaps in — no hydration mismatch). `sourceHtml` threaded through the annotate
  step + 6 reference clients; teacher combined-review passes `null` (Chunk 3).
- Sanitizer allowlist widened (tables/blockquote/links/images + h1–h6) with a
  hook forcing link `rel`/`target` and clamping `<img src>` to `data:`/`https:`.
- **Backfill:** `scripts/backfill-source-html.ts` rebuilds `source_html` for
  previously-added `.docx` assignments (see the spec at
  docs/superpowers/specs/2026-06-16-formatted-annotate-source-design.md §9).

**Still deferred (the genuinely hard part — needs `pdfjs-dist`):**
- PDF mode: PDF.js canvas + text layer; selection → offset via the
  `getTextContent()` concatenation that produced `source_text`;
  offset → highlight overlay rectangles over covered text items.
- Plain mode: unchanged (already annotatable today).
- Rich + PDF + plain all feed `text_annotations` unchanged.

### Chunk 3 — Teacher review render
- Reuse Chunk 2 renderers to paint student annotations on the review surface.

### Deferred to the p.52–53 walkthrough
- Citing a CD by paragraph number; the "Finding the Main Idea" sheet
  (Source → Main Idea → 2 CDs).

---

## 7. Top risk + the fallback that contains it

**PDF.js text-layer ↔ offset mapping** (spacing / hyphenation / item order) is the
riskiest piece. **Fallback:** if mapping proves unreliable, the *annotate* view
renders the PDF's extracted text as rich HTML, while **"Open original PDF"**
preserves exact fidelity. Annotation correctness therefore **never depends on**
PDF-native rendering succeeding — it degrades to the rich/plain path.

---

## 8. Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Structure storage | Artifact-carried (no normalized tables) | PDF/HTML already encode headings/¶/vocab |
| Annotation substrate | Keep `source_text` offsets | Zero change to shipped engine + saved data |
| Display | File-type hybrid (PDF-native / rich) | "Formatted & faithful"; PDF exact via Open-original |
| Teacher "Open file" | New tab, signed URL | No dependency; pixel-perfect reference |
| PDF annotation | `pdfjs-dist` | True PDF-native select-and-mark |
| `.docx` | `mammoth` now | Word docs arrive formatted |
| Rich editor | Minimal `contentEditable` | Avoid an RTE dependency; reuse sanitize pipeline |
