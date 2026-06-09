# Expository Graphic Organizer — Layout Specs

**Purpose.** Written layout specifications for the Expository student-flow graphic
organizers, extracted from the main Expository Guide (`docs/2023-2024JSWP-Expository-GuideFNL5-hires.pdf`,
2024 Third Edition). This is the implementation reference for chunks **4.5d-2**
(T-Chart visual) and **4.5d-3** (Shaping Sheet + Paragraph Form visual + color pass).

**How to use.** These specs describe the *printed* organizers. The digital UI should
be faithful to their structure and color/shape coding, not a pixel copy — adapt to
responsive web layout where the print geometry doesn't translate. Where a spec and an
existing app behavior conflict (e.g. 3+:0 CM-column suppression from chunk 4.5d-1),
the note calls it out explicitly.

**Source pages.** T-Chart 2+:1 p.93/103 · T-Chart 3+:0 p.54 · Shaping Sheet 2+:1
p.95/105 · Shaping Sheet 3+:0 p.55/56 · Paragraph Form p.57/72 · Gathering CDs p.91.

---

## Shared — JSWP color + shape coding

The "non-negotiable" JSWP color code (CLAUDE.md §4). The `--jswp-color-*` CSS
variables and accessibility shape symbols already exist from chunk 6.6a — currently
wired only into exemplar rendering. The 4.5d work extends them into the student flow.

| Role | Color | Shape (accessibility) | Used for |
|------|-------|----------------------|----------|
| TS / Revised TS | Blue | Trapezoid | Topic sentence, revised topic sentence |
| CD | Red | Rectangle | Concrete detail |
| CM | Green | Oval / ellipse | Commentary |
| CS | Blue | Trapezoid (inverted) | Concluding sentence |
| Intro / Conclusion | Black | — | Essay-level only |
| Thesis | Yellow | — | Essay-level only |

In the printed organizers the role-label *shapes* (blue trapezoid "TS", red rectangle
"CD", green oval "CM") double as section dividers — the shape *is* the label.

---

## T-Chart — 2+:1  *(chunk 4.5d-2)*

**Header band:** `STEP 4: COMPLETING THE T-CHART`
**Title:** `T-CHART`   ·   **Ratio label:** `(2+:1)`   ·   **Footer:** `Name` / `Date`

**Geometry — the "T" shape:**
```
┌─────────────────────────────────────────────┐
│ TS:            [____________________]       │  ← full width, top
│ Revised TS:    [____________________]       │  ← full width
├──────────────────────┬──────────────────────┤
│ CDs                  │ CMs                  │  ← two-column grid
│ [CD sentence rows]   │ [CM word/phrase grid]│
│                      │  + CM sentence(s)    │
├──────────────────────┴──────────────────────┤
│ CS:            [____________________]       │  ← full width, bottom
└─────────────────────────────────────────────┘
```
- **TS** and **Revised TS** are stacked full-width rows at the top.
- The middle is a **two-column grid**: left column header `CDs`, right column header `CMs`.
- **CS** spans full-width at the bottom. Top + bottom spanning rows + the two-column
  middle are what make the "T".
- The guide places small **numbered order badges (1–7)** on each region to teach
  completion sequence. Canonical JSWP order: (1) TS first draft → (2) CD sentences in
  the left column → (3) CM words/phrases brainstormed in the right column → (4) Revised
  TS, pulling from unused CM words → (5) CM sentence(s) from unused CM words → (6) CS
  from unused CM words. Render small numbered badges reflecting this order; exact badge
  placement is on PDF p.103 if pixel-level fidelity is wanted.
- **Color:** TS/Revised TS blue, CDs column red, CMs column green, CS blue. Color the
  T-Chart as part of this chunk — color is intrinsic to the layout, not a separable pass.

**Current state:** `CdCmTChart` renders a vertical chunk-card stack (Working TS textarea
→ chunk cards → CS textarea). No T-shape, no two-column grid.

---

## T-Chart — 3+:0  *(chunk 4.5d-2)*

**Header band:** `STEP 3: COMPLETING THE T-CHART`  *(STEP 3, not 4 — no gather_cds step at 3+:0)*
**Title:** `T-CHART (3+:0)`

**Structural differences from the 2+:1 T-Chart — not just "CM column hidden":**
- Top label is the full word **`TOPIC SENTENCE:`** (not `TS:`), single full-width row.
- **No `Revised TS` line at all.** TS revision pulls from unused CM words; 3+:0 has no
  CMs, so there is nothing to revise from. One TS row only.
- Bottom label is the full word **`CONCLUDING SENTENCE:`** (not `CS:`).
- The printed guide prints the `CMs` column *header* for layout symmetry, but it
  carries no content. **Decision (Raymond, 2026-06-08): match the print — render the
  empty `CMs` column header beside the CDs so the two-column "T" shape is preserved.**
  No CM inputs (a summary has zero commentary); the CMs side shows a muted "no
  commentary at 3+:0" note and is hidden on mobile. This supersedes the original
  chunk 4.5d-1 decision to suppress the column entirely.
- Net 3+:0 layout: `TOPIC SENTENCE:` (full width) → two-column `CDs` (3+ CD rows) |
  empty `CMs` header → `CONCLUDING SENTENCE:` (full width). Color: blue / red / blue.

---

## Shaping Sheet — 2+:1  *(chunk 4.5d-3)*

**Header band:** `STEP 5: EDITING & REVISING ON THE SHAPING SHEET`
**Title:** `SHAPING SHEET`   ·   **Ratio label:** `(2+:1)`   ·   **Footer:** `Name` / `Date`

**Geometry — single-column sequence of labeled boxes:**
```
  [TS]        ← blue trapezoid role-label
  [________________________]   first-draft TS box
  [________________________]   revised TS box

  [CD]        ← red rectangle role-label
  [________________________]   2+ CD sentence boxes

  [CM]        ← green oval role-label
  [________________________]   CM sentence box(es)

  [CS]        ← blue trapezoid role-label
  [________________________]   CS box
```
- Single column, top-to-bottom: **TS → 2+ CDs → CM → CS**.
- Each role is introduced by its **shape-label** (blue trapezoid TS, red rectangle CD,
  green oval CM) sitting above its sentence box(es) — the left-margin "shape" the audit
  flagged as absent.
- Sentence text is color-coded to its role.
- The guide marks this step with a `!` callout (the "moves and improves / underline all
  changes" reminder — students revise here, not just transcribe).

**Current state:** `cd-cm-shaping-bp-pane.tsx` + `pick-n-stitch-panel.tsx` capture the
material (TS, per-chunk CD/CM sentence lists, CS, notes) but render no labeled-box
column and no shape-labels. The pick-n-stitch side panel has no guide equivalent —
it's an app affordance; keep it, but it sits alongside the labeled-box column, not
instead of it.

---

## Shaping Sheet — 3+:0  *(chunk 4.5d-3)*

**Header band:** `STEP 4: EDITING & REVISING ON THE SHAPING SHEET`  *(STEP 4, not 5)*
**Title:** `SHAPING SHEET`   ·   **Ratio label:** `(3+:0)`

- Labeled-box sequence is **TS → 3+ CDs → CS** — **no CM box.**
- Same shape-labels (blue trapezoid TS, red rectangle CD, blue trapezoid CS).
- Consistent with chunk 4.5d-1's `computeGate` fix: a 3+:0 writing has zero CM
  sentences and must pass the Continue gate without them.

---

## Paragraph Form  *(chunk 4.5d-3)*

**Header band:** `FINAL STEP: PARAGRAPH FORM`  *(both ratios — "FINAL STEP")*
**Title:** `PARAGRAPH FORM`

- The assembled paragraph as **continuous color-coded prose** — not a stack of
  labeled boxes. Sentences flow together as a paragraph; first line indented.
- **Color coding carries through:** TS blue → CD sentences red → CM sentences green
  → CS blue. At 3+:0: TS blue → 3+ CD sentences red → CS blue (no green).
- Current state: `cd-cm-paragraph-form-bp-pane.tsx` renders a read-only material
  panel + a plain uncolored `final_text` textarea + word count. The finished paragraph
  must render in JSWP color. Decide in the 4.5d-3 audit whether the colored paragraph
  is auto-composed from the role-tagged sentences (preferred — the role mapping is
  known) or whether the student's assembled text is re-parsed; auto-composition from
  tagged sentences avoids a parsing problem.

---

## Gathering CDs — 2+:1  *(reference only — see note below)*

**Header band:** `STEP 3: GATHERING AND PRIORITIZING CDS`
**Title:** `GATHERING CDS (2+:1)`

- `PROMPT:` line at top.
- Instructions: (1) think of **5 or more** CDs, write them in the list; (2) **circle**
  the 2+ that fit the assignment best; (3) decide order, write `CD1` / `CD2` in **red**
  next to the chosen ones in priority order.
- Body: a bulleted list of ~7 blank CD lines.

**Note — not assigned to 4.5d-2 or 4.5d-3.** The audit rated Gathering CDs a MODERATE
visual delta (the candidate list + select-toggle + selection-order already exist; what's
missing is the "circle" affordance, the red `CD1`/`CD2` priority callout, and a
`pedagogyHint` that says "5 or more" where the guide says 5 and the app says 4). It's
not in the scope of either visual chunk as currently split. Decide separately: fold a
small Gathering-CDs polish into 4.5d-2, add a 4.5d-4, or backlog it. Flagged so it
isn't silently dropped.
