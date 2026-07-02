# Scope — Mirror TLCD quotation UI into argumentation + literary T-Charts

> Backlog item #5 ("Mirror TLCD quotation UI into `cd-cm-t-chart.tsx`").
> Scoped 2026-07-02. **UI-only lift** — schema, action, and query are already in place.

## Goal

Bring the "Embedding Quotations" affordance (Mark as quotation toggle → Lead-in / Citation
fields → read-only embedded-quotation preview) to the **argumentation** and **literary** T-Charts.
Expository already has it (chunk 4.5f-1); those two modes still render CDs as plain text.

Embedding quotations is canonical for all three of expository / argumentation / literary
(schema comment `0001:425`, CLAUDE.md §4, guide pp.77–78), so this closes a real pedagogy gap,
not just a cosmetic parity one.

## Why it's UII-only (already-built plumbing)

| Layer | Status |
|---|---|
| Columns `concrete_details.is_quotation / transitional_lead_in / source_citation` | ✅ exist (migration 0001) |
| Action `setConcreteDetailQuotation(writingId, cdId, fields)` | ✅ exists in `lib/actions/t-charts.ts`, **mode-agnostic** — only `requireRole("student")`, no mode branch |
| Query — fields selected + typed | ✅ `getTChartData` selects `is_quotation, transitional_lead_in, source_citation`; `ConcreteDetailData` (`lib/queries/t-charts.ts:63`) already carries all three |
| Expository reference UI | ✅ `CdEditor` in `components/student/writing/t-chart/expository-chunk-grid.tsx:233` |

So the argumentation/literary CDs already have the data flowing to them — they just don't render the controls.

## Routing (confirmed)

`t-chart-client.tsx` picks the CD renderer by mode:

- narrative (fictional) → `FictionalAbcPlan`
- narrative → `NarrativeTChart`
- **expository → `ExpositoryTChart` → `ExpositoryChunkGrid` → `CdEditor`** ← already has TLCD
- **everything else (argumentation, literary) → `CdCmTChart` → `ChunkEditor` → `CdRow`** ← **the port target**

The actual CD text input lives in `chunk-editor.tsx`'s `CdRow` (not `cd-cm-t-chart.tsx` itself —
the backlog title names the wrong file; `cd-cm-t-chart.tsx` only lays out TS / chunks / CS).

## Plan

### 1. Extract `CdEditor` to a shared component
Move the `CdEditor` function out of `expository-chunk-grid.tsx` into a new
`components/student/writing/t-chart/cd-editor.tsx`, exported. It's self-contained today
(text + toggle + lead-in/citation + preview; delete button stays external to it).
- Add an optional `placeholder?: string` prop so each caller keeps its own default copy
  (expository already customizes placeholder text by quotation state; keep that behavior).
- `expository-chunk-grid.tsx` imports it instead of declaring it locally — **no visual change** there.

### 2. Wire it into `chunk-editor.tsx` `CdRow`
Replace the bare CD `AutoSaveInput` (lines ~136–145) with `<CdEditor writingId cd disabled={isReadOnly} />`.
Keep the existing `[CD] label … [delete]` flex row; `CdEditor` drops into the `flex-1` middle slot.
Delete/CM rendering and the `kind === "sentence"` CM filter are untouched.

### 3. Verify read-only / teacher-review path
Teacher review reuses these student components verbatim (Option A composition, per backlog 4.7b).
`CdEditor` already disables the toggle + inputs when `disabled` and still renders the embedded
preview — so the returned/graded teacher view gets the assembled quote for free. No separate work,
but **browser-verify** it renders read-only correctly.

### 4. Tests
No tests currently cover these files. Add a component test for the shared `CdEditor`:
toggle on → fields appear → preview composes `lead-in "quote" (citation)`; toggle off is
non-destructive (inputs collapse, action called with `isQuotation:false`); `disabled` hides
controls but keeps preview.

## Decisions / notes for review

1. **Color tokens.** Shared `CdEditor` uses the CSS color-code var (`--jswp-color-cd`) for the CD
   text. `chunk-editor.tsx` currently frames CDs with Tailwind `red-*` + a "CD" label instead.
   After the port the CD text picks up the var while the surrounding label/border stay red — visually
   consistent (both are "CD red"), just sourced differently. Acceptable; flagging so it's intentional.
2. **Literary is 1:2+, not summary.** `isSummaryRatio` only suppresses CMs for `three_plus_to_zero`,
   so literary keeps its CMs and correctly shows the TLCD toggle. Confirmed.
3. **Placeholders.** Keep expository's quotation-aware placeholder as the default in the shared
   component; argumentation/literary inherit the same copy (generic enough — "from the text or your
   knowledge"). No per-mode copy needed unless you want it.
4. **Print / Paragraph Form — out of scope.** Quotations are woven into a CD sentence on the Shaping
   Sheet; Paragraph Form composes from there, not from `concrete_details`. So no print/paragraph-form
   change is needed for this item.

## Files touched

- **new** `components/student/writing/t-chart/cd-editor.tsx` (extracted `CdEditor`)
- `components/student/writing/t-chart/expository-chunk-grid.tsx` (import instead of local decl)
- `components/student/writing/t-chart/chunk-editor.tsx` (use `CdEditor` in `CdRow`)
- **new** `__tests__/components/cd-editor.test.tsx`
- No migration. No action/query change.

## Effort & risk

- **Effort:** small — ~1 extraction + 1 call-site swap + 1 test. A few hours.
- **Risk:** low. The frozen `chunk-editor.tsx` gets its first change since 4.5d-2, but the swap is
  additive (data already present, action already mode-agnostic). Main watch-item is the read-only
  teacher-review render — cover it in browser-verify.
- **Blockers:** none. Not pedagogy-gated (canonical) or tooling-gated.

## Acceptance

- [ ] Argumentation T-Chart CD shows Mark-as-quotation → Lead-in/Citation → embedded preview.
- [ ] Literary T-Chart CD shows the same.
- [ ] Expository T-Chart unchanged (still works via the extracted component).
- [ ] Teacher review renders the embedded quote read-only for a returned argumentation/literary writing.
- [ ] `npm run type-check` + `npm run build` green; new `CdEditor` test passes.
