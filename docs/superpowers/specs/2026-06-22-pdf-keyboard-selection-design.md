# Keyboard-Driven Annotation Creation on the PDF Text Layer — Design

> **Status:** Design approved 2026-06-22 (§1–9). Resolves the open accessibility
> concern flagged in `2026-06-16-pdf-annotate-design.md` §10 — *keyboard
> selection of evidence on a PDF*. This is a **spec only**; it unblocks the C2
> implementation chunk. No component code is written here.
>
> **Decision 1 (2026-06-22):** make the PDF text layer itself keyboard-operable
> (a span-navigation selection mode). We do **not** add a "view as text" toggle
> — that would fork the artifact a keyboard user annotates away from the one a
> mouse user sees, which is exactly the divergence CLAUDE.md §9 forbids
> ("the color code… can't be the only signal" generalizes to: the accessible
> path must be the *same* artifact, not a lesser sibling).

---

## 1. Problem

On the student Read & Annotate step the PDF renders as a `<canvas>` with a
transparent, absolutely-positioned **text layer** of `<span>`s laid over it
(`components/student/writing/pdf-source-viewer.tsx`). Each span carries
`data-start-offset`, the character offset of its text within `source_text`.

Three things already work:

1. **Mouse selection → create** — `onMouseUp` calls `commitSelection(true)`,
   which reads `window.getSelection()`, maps the anchor/focus spans to global
   offsets via `offsetFromNode`, and emits a `SelectionPayload`.
2. **Debounced keyboard/AT selection → create** — a `selectionchange` listener
   (debounced 350 ms, stood down while the mouse is dragging) routes through the
   *same* `commitSelection`, so a selection made by shift+arrows **once a caret
   already exists** opens the popover.
3. **Editing existing highlights by keyboard** — `drawHighlights(..., interactive)`
   makes the first rect of each annotation a real `role="button"`, `tabIndex=0`
   control (Tab to reach, Enter/Space to open its editor).

The remaining gap is **creating a brand-new annotation with the keyboard
alone.** Path 2 presupposes a text caret already sitting in the layer so the user
can press shift+arrow. But the text layer is non-editable (`<span>`s, not an
input/`contenteditable`), so a keyboard-only user has no way to *place* that
caret. Placing a caret in static text requires the browser's **caret-browsing
mode** (F7 on most browsers), which is **off by default** and not discoverable —
so in practice the keyboard create path is dead.

CLAUDE.md §9 makes WCAG 2.1 AA the floor; `2026-06-16-pdf-annotate-design.md`
§10 says this tension "must be resolved before calling this WCAG-AA complete."
The two SCs in scope:

- **2.1.1 Keyboard** — *all* functionality (including creating a selection)
  operable by keyboard, no caret-browsing prerequisite.
- **4.1.2 Name, Role, Value** — the navigation cursor and selection state must
  expose name/role/value to assistive tech.

## 2. Approach (decided): a managed span-navigation selection mode

We do not try to coax a caret into static text. Instead the text layer gains an
explicit, **self-contained selection mode**: a focus "cursor" roves over the
text-layer spans (Arrow keys), the user marks an **anchor** and **extends** the
selection, and **Enter commits** by synthesizing a DOM `Range` over the spanned
offsets and routing it through the **existing** `commitSelection` path. Esc
cancels.

The key insight that makes this cheap and correct: **every span already knows its
global offset** (`data-start-offset`), and `RenderState` already holds
`segments` (with `startOffset`/`endOffset` per item) and `spanByOffset` (offset →
`{ span, pageIndex }`). The selection mode is therefore a thin navigation layer
over data that already exists — it computes a `[start, end)` offset pair and
hands it to the same emit logic the mouse uses. **No new offset model, no new
payload, no change to the popover/form/save path.**

Rejected alternatives:

- **(A) "View as text" toggle / annotate the flat `SourceTextViewer` instead.**
  Forks the artifact: a keyboard user would highlight a *different* rendering
  than the one a sighted mouse user reads, losing the PDF's faithful layout that
  was the entire point of the PDF-native work. Violates "same artifact"
  (Decision 1).
- **(B) Make the text layer `contenteditable` to get a native caret.** Turns the
  authoritative substrate into an editable surface (accidental edits, IME
  weirdness, browser-divergent caret math) and fights the offset invariant. The
  spans must stay inert.
- **(C) Instruct users to enable caret browsing (F7).** Not discoverable, not
  uniform across browsers, and an external-mode prerequisite is not "keyboard
  operable" under 2.1.1. A non-starter.

## 3. Interaction model

### 3.1 Granularity: **word-level navigation, character-level commit envelope**

The roving cursor moves and selects at **word granularity** (one text-layer
span ≈ one pdf.js positioned item, which is typically a word or short run). The
emitted selection still resolves to exact character offsets — we just snap the
*navigation unit* to span boundaries.

Justification:

- **It matches the data.** pdf.js items are already word/run sized; spans tile
  the text. Word navigation is "next span / previous span" — O(1) over an
  existing ordered structure. Character navigation would require synthesizing
  per-glyph caret positions inside a `scaleX`-transformed span, which is exactly
  the brittle caret math we are avoiding.
- **It matches the pedagogy.** Students select *evidence* — phrases, clauses,
  sentences — not mid-word fragments. The JSWP annotation kinds (CD, CM, main
  idea, transition, note) are always whole-word-or-more. Snapping selection
  endpoints to word boundaries is pedagogically *correct*, not a compromise: a
  half-word highlight would be noise. (Mouse users can still sub-select a word;
  we are not removing that — we are giving the keyboard path a sane unit.)
- **Line granularity is offered as a faster jump, not the base unit** (see 3.3),
  because "select this whole line" is a common evidence gesture and arrowing
  word-by-word across a long line is tedious.

Trade-off acknowledged: a keyboard user cannot select *part* of a word. This is
acceptable (and arguably better) for evidence selection; it is recorded here so
C2 does not "fix" it by adding fragile intra-word caret logic.

### 3.2 Entering and leaving the mode

- **One tab stop owns the whole text layer.** The text layer (or a wrapper
  inside each `pageWrap`) becomes a single `tabIndex=0`, focusable region with
  `role="application"` (see §6 for why `application`, and its trade-off). Tab
  reaches it; Tab again leaves it. This is the roving-tabindex discipline that
  keeps the tab order sane (§4).
- **On focus**, the cursor lands on the first visible span at/after the current
  scroll position (or the first span on first entry). A live-region message
  announces the mode and the focused word (§5).
- **Esc** at any time exits the selection mode: clears any in-progress anchor,
  emits `onClearSelection`, and returns focus to the region wrapper (still one
  tab stop). A second Tab leaves the layer entirely.

### 3.3 Moving the cursor

| Key | Action |
|---|---|
| `ArrowRight` / `ArrowDown`-ish *(see note)* | Move cursor to **next span** (next word in reading order; crosses lines and pages). |
| `ArrowLeft` | Move cursor to **previous span**. |
| `ArrowDown` / `ArrowUp` | Move cursor by **line** — to the first span of the next / previous visual line (line membership derived from segment `y` within a page, page breaks treated as line breaks). |
| `Home` / `End` | First / last span of the current visual line. |
| `Ctrl+Home` / `Ctrl+End` | First / last span of the document. |

Reading order is the **segment array order** from `buildPdfText` — the same order
that defines offsets — so "next span" is unambiguous and already RTL/wrap-correct
by construction (buildPdfText emitted them in document order). The cursor index is
just an index into `segments` (or into a filtered "has a live span" view of it).

Note: ArrowRight/Left are word steps; ArrowUp/Down are line steps. This is the
conventional caret-navigation mapping and is what a screen-reader user expects.

### 3.4 Anchoring and extending (the selection)

Chosen gesture: **Shift+Arrow extends from an anchor**, mirroring native text
selection so it needs no learning.

- The cursor's current span is the implicit **caret**. There is no separate
  "set anchor" step for the common case.
- **Shift+ArrowRight/Left/Up/Down/Home/End** sets the anchor to the current span
  (if not already extending) and extends the selection to the new cursor
  position. The selection is the **inclusive span range** between anchor span and
  cursor span; its offsets are
  `start = min(anchor.startOffset, cursor.startOffset)`,
  `end = max(anchor.endOffset, cursor.endOffset)` (so a one-word selection still
  has `end - start ≥ 1`, satisfying `commitSelection`'s min-length guard).
- A plain (non-shift) Arrow **collapses** the selection back to a single-word
  cursor (native behavior).
- Visual feedback: the spanned words get a transient "marquee" style (a focus
  ring / tinted outline drawn in the highlight layer, distinct from committed
  annotation tints — e.g. a dashed outline, never a kind color, so it isn't
  mistaken for a saved highlight). This is *not* persisted; it is selection
  chrome.

Secondary anchor-then-extend affordance (optional, for AT users who can't easily
chord Shift): a discrete model where the **first Enter sets the anchor**, arrows
move the cursor, and the **second Enter commits** the anchor→cursor span. This is
listed as an enhancement, not the primary path; C2 ships Shift+Arrow first and
may add anchor-then-extend if the screen-reader smoke test (§9) shows chord
trouble. Both feed the same offset math.

### 3.5 Committing

- **Enter** (when a non-empty selection exists) commits. C2 builds a DOM `Range`
  spanning `spanByOffset.get(start).span` → the span containing `end`, sets it as
  the window selection, computes the bounding rect, and calls the **existing**
  `commitSelection`-equivalent emit so a `SelectionPayload` goes out — identical
  in shape to the mouse path. The popover mounts; **focus moves to the popover's
  "Annotate" button** (already focusable; Esc already dismisses it), closing the
  create loop entirely on the keyboard.
- Reuse note: rather than duplicate the emit body, C2 should factor the payload
  construction so both `commitSelection` (DOM-selection-driven) and the keyboard
  committer call one `emitSelection(start, end, rect)` helper. The DOM-selection
  read in `commitSelection` stays for the mouse path; the keyboard path may set
  the DOM selection *and* call the helper directly (belt and suspenders) — but
  must guard against a double-emit via the existing `lastEmittedRef` `"start:end"`
  de-dupe key.

### 3.6 Cancelling

- **Esc** with an in-progress selection: collapse to cursor, clear marquee,
  `onClearSelection`, stay in the mode.
- **Esc** with no selection: exit the mode (§3.2).
- **Esc** while the popover is open is already handled by the popover
  (`onDismiss`); on dismiss, focus should return to the cursor span so the user
  isn't dropped to the top of the page. (C2: the parent that owns popover
  state restores focus to the text-layer region and re-seats the cursor.)

## 4. Focus management

The hard constraint: a multi-page PDF has **hundreds of spans** and a growing set
of **per-annotation highlight buttons**. Naively making spans focusable would
produce hundreds of tab stops — a WCAG 2.4.3 (focus order) disaster.

Strategy — **roving tabindex with a single managed region**:

- The text layer region is **one tab stop** (`tabIndex=0`). Individual spans are
  **never** in the tab order (`tabIndex=-1` or simply not focusable; the cursor
  is tracked in component state and reflected with `aria-activedescendant`, see
  §6, or by moving DOM focus to the active span with `tabIndex=-1` and
  `focus()`). Arrow keys move the *cursor*, not the *tab stop*.
- The **existing highlight-edit buttons** remain their own tab stops today. To
  keep tab order sane across many annotations, C2 should reconcile the two
  systems so the page has a predictable, small set of stops. Recommended order
  within the viewer:
  1. the **create** region (this new mode), then
  2. the existing **edit** highlights.

  If the highlight count is large, a follow-up (logged, not in C2) may collapse
  highlight editing into the same managed region (arrow to a word that sits
  inside an annotation → Enter opens *that* annotation's editor instead of
  starting a new selection). C2 keeps them separate but must verify the combined
  tab order is coherent (create region → highlights → rest of page), not
  interleaved per-span.
- **Where focus goes on commit:** the popover "Annotate" button (§3.5).
- **Where focus goes on cancel/dismiss:** back to the cursor span / region
  (§3.6), never to `document.body`.
- **Scroll-into-view:** moving the cursor scrolls the active span into view
  (`scrollIntoView({ block: "nearest" })`), reusing the pattern already used for
  `scrollToAnnotationId`.

## 5. Accessibility — roles, labels, live announcements

### 5.1 Roles / structure

- Text-layer region: `role="application"` with an `aria-label` like *"Source
  text — press arrow keys to move, Shift+arrow to select, Enter to annotate,
  Escape to exit."* `application` is chosen deliberately: we are remapping
  Arrow/Shift/Enter to a custom selection model, and a `document`/`textbox` role
  would have the screen reader's own caret intercept those keys. The trade-off
  (`application` suppresses the SR's browse mode) is mitigated by the live region
  doing the reading (5.2) and by Esc always returning to a normal tab stop.
  C2 must verify this in the §9 screen-reader smoke test; if `application` proves
  hostile, the documented fallback is `role="grid"`/`gridcell` semantics with
  `aria-activedescendant`.
- Active span: marked via **`aria-activedescendant`** on the region pointing at
  the cursor span's `id` (spans get stable ids in C2), so the SR announces the
  active word without moving real focus. Each span used as a descendant needs
  `role="option"`/`text` and an accessible name (its own text content suffices).

### 5.2 Live-region announcements (an `aria-live="polite"` status node)

What is read as the user acts:

- **On enter:** "Selection mode. Use arrows to move by word, Shift+arrow to
  select, Enter to annotate." (Once; concise.)
- **On cursor move:** the focused word (the SR already says it via
  activedescendant; the live region stays quiet here to avoid double-speak —
  prefer activedescendant for word-by-word, live region for *state changes*).
- **On extend:** "Selected: <first word> … <last word>, N words." (Debounced so
  rapid Shift+Arrow doesn't flood; announce the settled selection, mirroring the
  350 ms debounce philosophy already in the file.)
- **On commit:** "Annotation menu open. Press Enter to choose a kind." (Focus is
  on the popover button; its own label carries the rest.)
- **On cancel:** "Selection cleared." / on exit: "Left selection mode."
- **Scanned PDF / no text layer:** the region is **not rendered** (there are no
  spans). The existing `role="status"` scanned-PDF notice already explains why;
  the keyboard mode simply has nothing to operate on, which is correct
  (§7 edge cases).

### 5.3 Granularity & SC mapping

- **2.1.1 Keyboard:** creating a selection now needs only Tab + Arrows +
  Shift+Arrow + Enter — no caret-browsing prerequisite. Met.
- **4.1.2 Name/Role/Value:** region role + label, active word via
  activedescendant, selection state via live region. Met.
- **2.4.3 Focus order:** single tab stop for the region (§4). Met.
- **2.4.7 Focus visible:** the cursor span and the marquee both render a visible
  ring (not color-only — a ring/outline shape, consistent with §9 of CLAUDE.md).
- Word-granularity acceptability is argued in §3.1 and is pedagogically aligned
  with evidence selection.

## 6. Reuse contract (what must NOT change)

- **Emits the same `SelectionPayload`** (`source-text-viewer.ts`):
  `{ rangeStart, rangeEnd, selectedText, rect }`. The keyboard committer fills
  exactly these fields; `selectedText = state.text.slice(start, end)`, `rect`
  from the synthesized range's `getBoundingClientRect()`.
- **Does not disturb the mouse path:** `onMouseDown`/`onMouseUp` →
  `commitSelection(true)` is untouched. The keyboard mode only adds key handlers
  on the region.
- **Does not disturb the debounced `selectionchange` path:** that listener stays.
  Because the keyboard committer may set the window selection, it must funnel
  through the **same `lastEmittedRef` de-dupe** (`"start:end"`) so a commit
  followed by a trailing `selectionchange` for the same range doesn't double-fire.
  C2 verifies no double popover.
- **No schema, no server action, no popover/form change.** `text_annotations`,
  RLS, the save path, and `AnnotationPopover` are all reused as-is. The popover
  is already keyboard-complete (focusable button, Esc to dismiss).
- **`readOnly` still disables creation:** the mode is inert (or unrendered) when
  `readOnly` (reference panels / teacher review), exactly as `commitSelection`
  early-returns on `readOnly` today.

## 7. Edge cases

- **Selection spanning page breaks.** Offsets are global across pages
  (`buildPdfText` inserts a `"\n"` page-break separator), so a cross-page anchor→
  cursor range is a single `[start, end)`; the synthesized DOM range may span two
  `pageWrap`s. `commitSelection` already clamps to `[0, text.length]`. The rect
  for the popover: use the **cursor end's** rect (or the first client rect), not
  a union spanning the page gutter, to avoid an off-screen popover. C2 picks the
  end-anchored rect and verifies popover placement.
- **Empty / whitespace-only spans & separators.** Separators (space/newline/page
  break) belong to *no* span (they live between `endOffset` and the next
  `startOffset`). Word navigation steps span-to-span, so the cursor never lands
  "in" a separator; the emitted range naturally includes interior separators
  (e.g. the space between two selected words) because offsets tile contiguously.
  A span whose `str` is only whitespace is skipped by the cursor (treat as
  non-stop) so users don't waste keystrokes on invisible runs.
- **Very long PDFs.** Navigation is O(1) per keystroke (index into `segments`);
  no per-keystroke layout. `scrollIntoView({ block: "nearest" })` keeps the
  cursor visible. The render-all-pages cap noted in the §16 spec still applies;
  page virtualization (future) would require the cursor to trigger lazy render of
  the target page — logged as a dependency for that future work, out of scope for
  C2.
- **RTL / wrapped lines.** "Next span" follows `segments` order, which
  `buildPdfText` produced in document/reading order, so RTL and wrapped lines are
  handled by construction for word stepping. **Line** stepping (ArrowUp/Down) is
  a heuristic over segment `y` within a page; for RTL or complex columnar PDFs it
  may be imperfect — C2 implements line stepping as best-effort and **word
  stepping remains the reliable primary path** (the spec does not promise perfect
  line geometry on pathological layouts; it promises reliable word-level
  selection, which is sufficient for 2.1.1).
- **Scanned / no-text PDF.** `status === "scanned"`: no text layer is built, so
  the keyboard region is **not rendered** and `onUnannotatable` already relaxes
  the Continue gate. Nothing to operate on; the existing amber notice explains.
  No regression.
- **pdf.js load/offset-mismatch fallback (`status === "error"`).** Parent swaps
  to the flat `SourceTextViewer`, whose native text *does* support keyboard
  selection (real DOM text, caret works). So the fallback path is already
  keyboard-accessible; the new mode is specific to the PDF text-layer renderer.
- **Mid-selection annotation overlap.** If the user extends across an existing
  highlight, that's fine — creating a new (possibly overlapping) annotation is
  already supported by the data model; the popover/form decide the kind.

## 8. Risks

- **`role="application"` hostility to screen readers** (suppresses browse mode).
  Mitigation: live region + activedescendant; Esc returns to a normal stop;
  documented `grid` fallback. **Must be browser + SR verified (§9).**
- **Double-emit** between the synthesized selection and `selectionchange`.
  Mitigation: shared `lastEmittedRef` de-dupe; explicit test.
- **Line-stepping geometry** on RTL/columnar PDFs. Mitigation: word stepping is
  the guaranteed path; line stepping is best-effort.
- **Tab-order coherence** once create-region and edit-highlights coexist.
  Mitigation: explicit ordering (§4) and a browser tab-through check.
- **Cursor focus math inside `scaleX`-transformed spans** if anyone later tries
  intra-word carets. Mitigation: §3.1 forbids it; word granularity sidesteps it.

## 9. Phased build outline for C2 (implementation chunk)

> **C2 MUST be browser-verified.** Canvas rendering, real-PDF `getTextContent`,
> DOM `Range`/selection, and `scrollIntoView` do **not** run meaningfully under
> jsdom (consistent with `2026-06-16` §7). The acceptance bar includes a manual
> browser pass **with caret-browsing OFF** and a **screen-reader smoke test**
> (NVDA or VoiceOver) confirming the announcements in §5.2 and that the
> `application` role doesn't trap the user.

| Phase | Goal | Verify |
|---|---|---|
| 0 | Stable span ids + a "navigable segments" view (filter whitespace-only); cursor state in the component | Unit-test the pure navigation reducer (index moves: word/line/home/end) with synthetic segments |
| 1 | Focusable region (`role="application"`, label, single tab stop); cursor render + visible ring; Arrow word/line stepping; `scrollIntoView` | Browser: Tab in, arrow around, ring visible, scroll follows; caret-browsing OFF |
| 2 | Shift+Arrow extend → marquee chrome → offset `[start,end)` computation | Unit-test the pure offset math (anchor/cursor → start/end, min-length); browser: marquee correct |
| 3 | Enter commits via shared `emitSelection(start,end,rect)`; focus → popover button; `lastEmittedRef` de-dupe; Esc cancel/exit + focus restore | Browser: full create loop keyboard-only; verify **no double popover** vs `selectionchange` |
| 4 | Live region + `aria-activedescendant` wiring; announcement copy (§5.2) | **Screen-reader smoke test** (NVDA/VoiceOver): enter, move, extend, commit, cancel all announced |
| 5 | Edge cases: cross-page range rect, whitespace spans, scanned (region absent), `readOnly` inert, tab-order coherence with edit-highlights | Browser matrix incl. a 2-page PDF and a scanned PDF |
| 6 | Independent review (offset invariant intact, reuse contract honored, a11y) | jswp-reviewer + ux-design-specialist; confirm WCAG 2.1.1 / 4.1.2 met |

**No `jswp-database` work** — no schema/RLS/migration; offsets, payload, popover,
and save path are unchanged. No new dependency (uses DOM `Range`, existing
`RenderState`). No approval gate beyond Decision 1, already taken.

## 10. Out of scope

- Folding existing-highlight **editing** into the same managed region (a
  follow-up; C2 keeps create and edit as separate, coherent tab stops — §4).
- Intra-word (character) keyboard selection (§3.1 — deliberately excluded).
- Page virtualization interplay for very long PDFs (§7 — future).
- The flat/rich renderers' keyboard story (already native; unaffected).
- Teacher-review keyboard creation (review is `readOnly`; mode is inert there).
