# Expository Guide-Fidelity Plan

Implementation plan to close the gaps found in the 2026-05-27 review of the
**Expository/Informational Writing Across-the-Curriculum** Teacher's Guide
(2024 Third Edition, `docs/reference/Sec_Exp (1).pdf`) against the app's
Expository student flow. Companion to the Open items in
[`docs/BACKLOG.md`](BACKLOG.md) — this doc sequences them into shippable chunks.

**Series:** `phase-4.5f-1 … 4.5f-5` (adjacent to the 4.5d expository visual
rebuild and 4.5e gather work). Each chunk ends with the normal `ship-chunk`
ritual (type-check → build → commit → memory → chain).

**Decisions locked (2026-05-27):**
- Scope = all five gaps, sequenced by priority.
- Thesis/intro frames = build the engineering now, **flag the exact pedagogy
  wording for Dr. Louis confirmation before merge** (do not invent content).

**Migrations consumed:** 0022 (decode), 0023 (annotation enum), 0024 (shaping
moves). 0021 is the highest currently shipped. All three need a matching
hand-edit to `lib/database.types.ts` (still hand-written; regen is the
separate P7-2 backlog item).

---

## Status

| # | Chunk | Migration | Pedagogy gate | Status |
|---|-------|-----------|---------------|--------|
| 4.5f-1 | TLCD: embed quotations in the T-Chart | — | none | ✅ Shipped (chunk 4.5f-1) |
| 4.5f-2 | Decode: Background / Trigger / Task | 0022 | none | ✅ Shipped (chunk 4.5f-2) · migration 0022 applied to live 2026-05-27 |
| 4.5f-3 | Annotate: capture the Main Idea | 0023 | none | ✅ Shipped (chunk 4.5f-3) · migration 0023 applied to live 2026-05-27 |
| 4.5f-4 | Essay frames: mode-aware thesis + intro | — | ⚠ Dr. Louis | ✅ Built on `v2` (chunk 4.5f-4) · ⚠ wording PENDING Dr. Louis before master |
| 4.5f-5 | Shaping: the five-move checklist | 0024 | none | ✅ Shipped (chunk 4.5f-5) · ⚠ migration 0024 NEEDS live apply |

Only 4.5f-4 is content-blocked; the other four are pure engineering and can
ship independently. 4.5f-4 can slot last or pause for Dr. Louis without
holding up the rest.

---

## Open decisions (don't block starting)

- **4.5f-1 scope:** quotation UI in all three modes (expository + argumentation
  + literary share the component shape) or expository-only?
- **4.5f-3 depth:** range-underline of the main idea alone, or range-underline
  **plus** a free-text "main idea in your words" field?

---

## Chunk 4.5f-1 — TLCD: embed quotations in the T-Chart

*No migration · no pedagogy gate · highest leverage.*

**Gap.** `concrete_details.is_quotation / transitional_lead_in / source_citation`
exist (`migrations/0001_init_jswp_schema.sql:426-428`) and the `t-charts` query
already returns them, but `expository-chunk-grid.tsx` renders each CD as a plain
textbox. The guide's 2+:1 T-Chart prints per-CD **Lead-in / Quotation / citation**
lines (2024 guide T-Chart p.79 "Hammurabi," pp.111-112 two-chunk "Gold Rush"),
and "Embedding Quotations" is a standalone micro-lesson (pp.77-78).

**Schema.** None.

**Files.**
- `lib/actions/t-charts.ts` — add `setConcreteDetailQuotation(writingId, cdId, { isQuotation, transitionalLeadIn, sourceCitation })`, or extend `updateConcreteDetail`.
- `components/student/writing/t-chart/expository-chunk-grid.tsx` — "Mark as quotation" toggle on each CD (`CdCell` + `CdCmRow`); when on, reveal **Lead-in** and **citation** inputs around the quotation text, with the lead-in starter-word hint (After / Although / Before / Because / If / Since / When / While).
- `components/student/writing/t-chart/cd-cm-t-chart.tsx` — mirror for argumentation/literary **if** the all-modes decision is taken (see Open decisions).

**Acceptance** *(corrected in audit — TLCD is a T-Chart authoring aid; Paragraph Form composes from the Shaping Sheet's woven sentences, not from `concrete_details`).*
- [x] Toggle "Mark as quotation" persists `is_quotation = true` and reveals Lead-in + Citation inputs.
- [x] Lead-in + Citation autosave and survive reload.
- [x] Read-only preview shows `lead-in "quote" (citation)` when `is_quotation = true` and quote text is non-empty.
- [x] Toggling off collapses inputs without deleting stored values (`setConcreteDetailQuotation` only touches `is_quotation` on toggle).
- [x] Works in both 2+:1 (`CdCmRow`) and 3+:0 (`CdCell`); read-only review renders via the same `CdEditor`.
- [x] type-check + build clean.

**Closes.** BACKLOG "TLCD support on CDs" (Expository). Argumentation/literary mirror split into a new Open entry.

---

## Chunk 4.5f-2 — Decode: Background / Trigger / Task decomposition

*Migration 0022 · no pedagogy gate.*

**Gap.** `decode-prompt-step.tsx` captures task / form / ratio / key_verbs /
focus_terms / notes — strong on the *task* but never has the student split the
prompt into **Background sentence(s) / Trigger sentence / Task**, nor identify
**"where will I find my concrete details?"** (the Trigger's whole job). Guide:
2024 pp.135-139; "Ask yourself, 'Where will I find the concrete details?'" p.138.

**Migration `0022_prompt_decoding_three_parts.sql`.**
```sql
ALTER TABLE prompt_decodings
  ADD COLUMN background_text TEXT,
  ADD COLUMN trigger_text    TEXT,
  ADD COLUMN cd_source       TEXT;   -- "where will my CDs come from?"
```
All nullable — existing rows load fine.

**Files.**
- `lib/database.types.ts` — add the three columns to `prompt_decodings` Row/Insert/Update.
- `lib/actions/prompt-decoding.ts` — extend `PromptDecodingFields`.
- `app/student/writings/[id]/_steps/decode-prompt-step.tsx` — add Background, Trigger, and the "Where will my concrete details come from?" fields (the cd_source field tied to the trigger).

**Acceptance.**
- [x] Migration `0022` written (3 nullable columns). **⚠ Needs live Supabase apply.**
- [x] Decode step shows Background / Trigger / "Where will you find your concrete details?" grouped above Task.
- [x] New fields autosave on blur and persist across reload (`savePromptDecoding` upsert + `sanitize` trim→null).
- [x] Continue still gated only on a non-empty `task`.
- [x] Teacher review (`combined-view.tsx`) renders the three fields read-only.
- [x] Existing decodings load with the new fields empty (nullable; `getPromptDecoding` uses `select("*")`).
- [x] type-check + build clean.
- [x] Applies to all four modes (shared decode step), not expository-only.

---

## Chunk 4.5f-3 — Annotate: capture the Main Idea

*Migration 0023 (enum) · no pedagogy gate.*

**Gap.** Highlighting supports cd / cm / transition / note
(`annotation-kind-config.ts`) but there's no "Main Idea / thesis" anchor. The
guide's annotation artifact is the **"Finding the Main Idea"** sheet — per source,
**title → main idea (quoted/paraphrased, underlined in black) → 2 supporting CDs**
(2024 guide pp.52-53).

**Migration `0023_annotation_kind_main_idea.sql`.**
```sql
ALTER TYPE jswp_annotation_kind ADD VALUE 'main_idea';
```
Own migration — `ADD VALUE` can't share a transaction with its first use;
Supabase PG15 handles it.

**Files.**
- `lib/database.types.ts` — add `'main_idea'` to the `jswp_annotation_kind` enum.
- `components/student/writing/annotation-kind-config.ts` — add `main_idea` (black/neutral, "underline the source's main idea or thesis"); add to `ANNOTATION_KIND_ORDER`.
- Kind-picker UI / sidebar — pick up the new kind automatically via the config.
- *Optional (Open decision):* a per-writing "Main idea (in your words)" text field if range-underline alone feels thin.

**Acceptance.** *(Open decision resolved in audit: range-underline only, paraphrase lives in the existing `note` field — no new column.)*
- [x] Migration `0023` written (`ADD VALUE IF NOT EXISTS 'main_idea'`, bare/no-txn). **⚠ Needs live Supabase apply.**
- [x] "Main Idea" appears first in the kind dropdown; saving works (`VALID_KINDS` allowlist updated — the one non-config-driven spot).
- [x] `main_idea` renders with a dark-underline treatment (echoes "underline in black"); sidebar groups it (groupByKind now seeded from `ANNOTATION_KIND_ORDER` so it can't drift).
- [x] Paraphrase uses the existing annotation `note` field; no new column.
- [x] Continue gate unchanged (≥1 annotation, any kind).
- [x] Teacher review renders `main_idea` (config-driven viewer/sidebar).
- [x] type-check + build clean.

---

## Chunk 4.5f-4 — Essay frames: mode-aware thesis + intro

*No migration · ⚠ pedagogy-flagged.*

**Gap.** Thesis frames (`thesis-step.tsx`: open / framed_but / framed_although /
three_pronged) lean argumentation; intro hooks (`introduction-step.tsx`:
anecdote / internal_monologue / dialogue / …) lean narrative. For Expository the
guide's **"framed"** means *name the topic of each body paragraph*, **"open"**
means *don't*, plus a beginner **"Flip the Prompt"** template; openers are
historical-background / current-event / quotation / question-or-problem /
startling-fact (2024 pp.117-122). Conclusion (`conclusion-step.tsx`) already
does restate-don't-repeat but is unscaffolded vs. the narrow→broad pyramid
(pp.126-128).

**Schema.** None.
- `thesis_frame` reuses existing enum values: expository maps to `open` +
  `three_pronged` (three_pronged = framed-by-naming for a 3-BP essay).
- `introduction_hook_kind` is a `VARCHAR(50)` — opener options are pure UI.

**Files.**
- `components/student/writing/essay-parts/essay-part-form.tsx` — accept mode-aware option lists / help text.
- `app/student/writings/[id]/_steps/thesis-step.tsx` — expository frame options + help; add the **"Flip the Prompt"** template helper (`In <Author>'s "<Title>," <Subject> <Explanation>`).
- `app/student/writings/[id]/_steps/introduction-step.tsx` — expository opener options + an inverted-pyramid hint.

**⚠ Pedagogy flag (confirm with Dr. Louis before merge).**
- Exact expository frame labels and help wording.
- Flip-the-Prompt template wording.
- Whether expository needs a distinct `framed` enum value vs. reusing
  `three_pronged` (if a new value is required, this chunk gains a migration).

**Acceptance.**
- [x] Expository essay shows expository frames (Open / Framed) + openers (historical-background / current-event / quotation / question-or-problem / startling-fact) + Flip-the-Prompt helper + inverted-pyramid hint.
- [x] Argumentation / literary / narrative essays are unchanged (mode-keyed option sets).
- [x] No enum migration — expository "framed" reuses `three_pronged`; openers are free strings (`introduction_hook_kind` is VARCHAR).
- [x] Stored out-of-list value stays selectable (`KindSelect` passthrough).
- [x] `ThesisStep` receives `mode` at both call sites; teacher review unaffected.
- [x] type-check + build clean.
- [ ] **⚠ PENDING DR. LOUIS** — confirm frame/opener labels, the Flip-the-Prompt wording, and whether expository wants a dedicated `framed` enum value (→ migration) before merge to master. Tracked in BACKLOG.

---

## Chunk 4.5f-5 — Shaping: the five-move checklist

*Migration 0024 · no pedagogy gate · coordinate with 15 Grammar Rules.*

**Gap.** The guide defines the Shaping Sheet by five explicit moves — (1) add
transitions, (2) vary sentence openings, (3) vary sentence types, (4) fix
mechanics, (5) add/delete for voice (2024 glossary pp.151-152; Paragraph Form
notes p.72). `cd-cm-shaping-bp-pane.tsx` folds all five into one "Move and
improve" callout with no per-move affordance.

**Migration `0024_shaping_revision_moves.sql`.**
```sql
ALTER TABLE shaping_sheets ADD COLUMN revision_moves TEXT[];
```
Kept separate from `rules_applied`, which is reserved for the 15 Grammar Rules.

**Files.**
- `lib/database.types.ts` — add `revision_moves` to `shaping_sheets`.
- `lib/actions/shaping.ts` — persist the checklist.
- `components/student/writing/shaping/cd-cm-shaping-bp-pane.tsx` — a non-blocking five-item checklist.

**⚠ Coordinate.** Overlaps the backlogged "Implement Dr. Louis's 15 Grammar
Rules" surface — the five moves are likely a subset/precursor. Don't ship a
competing rules UI; note the relationship so the two don't conflict.

**Acceptance.**
- [x] Migration `0024` written (`revision_moves TEXT[]`, nullable). **⚠ Needs live Supabase apply.**
- [x] Five-move checklist renders under the "Move and improve" callout (expository/argumentation/literary panes).
- [x] Checking a move persists to `revision_moves` (optimistic, reverts on error); reload reflects it.
- [x] Non-blocking — Continue gate unchanged.
- [x] Teacher review renders the checklist read-only (disabled via `isReadOnly`).
- [x] Kept separate from `rules_applied` (15 Grammar Rules surface).
- [x] type-check + build clean; unit suites pass (RLS integration suite needs live Supabase, unrelated).

---

## Source references (guide page map)

| Topic | 2024 Expository guide pages |
|-------|------------------------------|
| Embedding Quotations (micro-lesson) | 77-78 |
| T-Chart with embedded quotations | 79 (Hammurabi), 111-112 (two-chunk Gold Rush) |
| Decoding the prompt (3 parts) | 135-139 (trigger / "where are my CDs?" p.138) |
| Finding the Main Idea sheet | 52-53 |
| Thesis = Subject + Explanation; framed vs open; Flip the Prompt | 117-118 |
| Introduction (inverted pyramid, openers, 3-section build) | 119-122 |
| Conclusion (narrow→broad, restate-don't-repeat) | 126-128 |
| Shaping Sheet five revision moves | 151-152; paragraph-form note p.72 |
