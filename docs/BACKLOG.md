# Backlog

Consolidated list of deferred work that isn't part of a current chunk. Most items are tagged for **Phase 7** (polish + production cutover) per `docs/DEV_PLAN.md`. Anything that needs attention sooner is called out by priority.

When you finish an item, move it to **Closed** with the commit hash. Don't delete — the closed list is the audit trail.

Last reviewed: chunk P7-1. Expository guide-fidelity review 2026-05-27 added 5 Open items (Decode 3-part, Annotate Main Idea, thesis frames, intro pyramid, Shaping 5 moves) and enriched "TLCD support on CDs."

---

## Open

### Expository step subLabels are off-by-one for 3+:0
`jswp-modes.ts` hard-codes each Expository step's `subLabel` as a static
`"Step N"` string ("Step 1" … "Step 5"), numbered for the 2+:1 sequence.
Chunk 4.5d-1 made the sequence ratio-dependent (3+:0 drops `gather_cds`),
so for a 3+:0 writing every step from `t_chart` onward is labelled one
higher than its real position — the step sidebar shows "Step 4" for what
is actually step 3, etc. Chunk 4.5d-2 renders the *correct* number in the
T-Chart's own header band (from `chunkRatio` via `getExpositoryTChartSpec`),
but the sidebar is still wrong. Fix = derive step numbers dynamically from
the resolved (ratio-aware) visible step list rather than ratio-branching
the static strings. Affects `lib/jswp-modes.ts` (drop/replace the static
`subLabel` numbers) + the step sidebar that renders them.
- **Identified:** chunk 4.5d-2
- **Priority:** before production cutover (Phase 7) — visible but not blocking

### Is 3+:0 argumentation pedagogically valid? (assignment-form question)
Chunk 4.5d-1 made the Expository flow ratio-aware: 3+:0 (summary) drops the discrete Gathering & Prioritizing CDs step, and the 3+:0 CM-correctness fixes (zero starter CM slots, no CM rows in the T-Chart, Shaping gate skips the CM requirement) are keyed on per-chunk `chunk.ratio`, so they apply to **any** 3+:0 chunk regardless of mode. But `omitForRatio` is set only on `expository.gather_cds` — so an Argumentation assignment set to 3+:0 lands in a "partially correct" interim state: it gets the CM fixes but keeps its `gather_cds` step. The real question is upstream, not "extend `omitForRatio` to `argumentation.gather_cds`": **should the assignment form offer 3+:0 for Argumentation at all?** Argumentation is inherently a commentary-driven mode (you can't argue with zero commentary) — 3+:0 is the *summary* ratio. If 3+:0 argumentation isn't a real JSWP use case, the fix is to remove that option from the `assignment-form.tsx` ratio dropdown for `mode = "argumentation"` (the `assignments` CHECK constraint could also be tightened), not to special-case the step engine. Needs a pedagogy call from Dr. Louis / Raymond before either path.
- **Identified:** chunk 4.5d-1
- **Priority:** before production cutover (Phase 7) — small, but blocked on a pedagogy decision

### Exemplar step-match uses persisted current_step, not URL [step]
6.5's per-step exemplar tagging filters by `writing.current_step` (the persisted column updated on save / `navigateToStep`). The student writing flow URL `[step]` segment is the actually-displayed step. They align on every normal navigation (sidebar clicks fire `navigateToStep` before the route change), but a backwards URL navigation by hand could briefly diverge — student lands on the thesis URL while `current_step` is still `paragraph_form`, and the reference panel filters to paragraph_form. Reconcile by either passing `[step]` down through the layout via a context the page populates, or by reading the URL on the page level and re-fetching exemplars there. Low impact in practice; tracked so a Phase 7 audit doesn't miss it.
- **Identified:** chunk 6.5
- **Priority:** polish; before production cutover (Phase 7)

### Storage upload UI failure surface
Storage upload errors currently log to console only; users see no feedback when an upload fails. Surface failures inline (toast or form-level error).
- **Identified:** pre-Phase 4
- **Priority:** before production cutover (Phase 7)

### Mirror TLCD quotation UI into `cd-cm-t-chart.tsx` (argumentation + literary)
Chunk 4.5f-1 wired the "Mark as quotation" toggle + Lead-in / Citation fields + embedded-quotation preview into the **Expository** T-Chart (`expository-chunk-grid.tsx` → shared `CdEditor`). Argumentation and literary render their T-Charts through the deliberately-frozen `cd-cm-t-chart.tsx` + `chunk-editor.tsx` (untouched since 4.5d-2), so they still store CDs as plain text. Embedding quotations is canonical for all three modes (schema comment `0001:425`, CLAUDE.md §4, guide pp.77–78). Port the `CdEditor` affordance (extract it to a shared component) into the argumentation/literary CD cells. The `transitional_lead_in` / `source_citation` columns and the `setConcreteDetailQuotation` action already exist — UI-only lift.
- **Identified:** chunk 4.5f-1 (split out of the original "TLCD support on CDs" item)
- **Priority:** before production cutover (Phase 7) — pedagogically canonical

### Remove `as unknown as <Shape>` TS narrowing hacks (chunk P7-2)
The P7-1 audit revealed the actual count is **34 casts across 23 files**, not 2 across 2 as originally noted. Most narrow Supabase nested-embed results (`assignment:assignment_id ( ... )`) — the same root cause: the hand-written `Database` types don't carry the relationship metadata Supabase needs to infer embed shapes. Two outliers in `lib/actions/assignments.ts` cast a typed rubric to `Json` for a JSONB column (different problem; would not be fixed by regen).

Plan for chunk P7-2:
1. `npx supabase gen types typescript --project-id hcdvypzfzrzevkwkssiw --schema public > lib/database.types.ts` (requires `supabase login` or `SUPABASE_ACCESS_TOKEN` env — not currently configured).
2. Audit type-check output for unexpected drift (column renames since the hand-write, enum changes, etc.).
3. Remove obsolete `as unknown as` casts across `lib/actions/`, `lib/queries/`, and the 5 scattered hits in `app/`.

Affected files (from `grep -c "as unknown as"`):
- `lib/actions/`: assignments (2), candidate-cds (1), commentary (1), final-draft (1), prompt-decoding (1), roster-import (1), shaping (2), student-writings (3), writing-structure (2)
- `lib/queries/`: assignments (2), candidate-cds (1), classes (3), commentary (1), final-draft (2), paragraph-form (1), shaping (1), students (2), student-writings (1), teacher-feedback (1), teacher-writings (2), t-charts (1)
- `app/`: admin/import/students (1), student/writings/[id]/_steps/counterargument-step (1)

- **Identified:** chunk 4.2 (commit `fffc3ac`); rescoped in chunk P7-1 audit
- **Priority:** before production cutover (Phase 7); blocked on Supabase CLI auth setup

### Rebuild district management UI under `/admin/districts`
Path A in P7-6 deleted the v1 super-admin district CRUD surface (create, edit, branding/POC, add/remove district-admin, cross-district user list) because v2's `/admin/` doesn't have equivalents. Provisioning currently runs via the Supabase SQL Editor. When multi-tenant district onboarding becomes a real need, rebuild in `/admin/` using v2's patterns (server components, RLS-scoped queries, `useActionState` forms). Scope on rebuild:
- District CRUD (list, detail, create, edit) with branding (logo + primary/secondary colors) and POC fields.
- District-admin role assignment (add/remove).
- Cross-district user listing for super-admin.
- Cross-district analytics surface (deferred until the per-assignment analytics shape from chunk 5.2 has stabilized; a cross-district view will likely reuse the same card components rather than the deleted `AnalyticsDashboard`).
- **Identified:** chunk P7-6
- **Priority:** before first production tenant onboarding

### Phrase-to-word linking on `commentary_items`
Literary's elaboration step (chunk 4.5b2) pools phrase CMs per CD via `parent_cd_id` only. The pedagogyHint says "for each CM word, write a synonym, then two phrases" — implying a 1:1 word→phrase association. Schema doesn't enforce this. Adding a `parent_cm_id UUID REFERENCES commentary_items(id) ON DELETE CASCADE` column would let elaboration link each phrase to the specific best-word it elaborates, improving pedagogical fidelity. Requires migration; not load-bearing for any current step.
- **Identified:** chunk 4.5b2 audit
- **Priority:** polish; before production cutover (Phase 7)

### Consolidate live-count textarea pattern
Extend `AutoSaveInput` with an optional `onChange` callback prop, OR extract a shared `<LiveCountTextarea>` helper. Currently chunk 4.6b's CD/CM and Narrative paragraph-form panes inline ~40 lines of AutoSaveInput-shaped code each to support live word-count display (which needs `onChange` access). Chunk 4.6c's final-draft surface will likely want the same. Consolidating reduces duplication.
- **Identified:** chunk 4.6b
- **Priority:** polish; before production cutover (Phase 7)

### Implement Dr. Louis's 15 Grammar Rules
Cross-cutting JSWP pedagogy per CLAUDE.md §1. The `shaping_sheets.rules_applied TEXT[]` column already exists in the schema for tracking which rules a student applied during shaping. Three deliverables:
1. **Content** — rule titles, descriptions, examples per rule, sourced from the printed guides. Per CLAUDE.md §15, requires explicit user approval before invention.
   - **⚠ Source discrepancy (verified 2026-05-25, chunk 4.5d-3):** CLAUDE.md §13's cited locations are WRONG for the editions on disk. Full-text search of the 2024 Expository guide (`docs/reference/Sec_Exp (1).pdf`, byte-for-byte the same Third Edition as `2023-2024…FNL5`) and the 2018 P&F Narrative guide found **no enumerated "15 Grammar Rules" section** in either — only *distributed* guidance ("Transitions That…" Expos p.81, sentence-variety lines in the rubrics, and the Narrative "Helping Hand" syntax checklist: Sentence Beginnings Vary / Sentence Types Vary / Parallel Structure). The canonical 15-rule list is presumably in the **2019 Argumentation guide** or **RTL Quick Start v4** (neither on disk) or a standalone grammar handout. Do NOT extract "15 rules" from the Expository/Narrative guides — they aren't there. Get the real source before building.
2. **`lib/jswp-grammar-rules.ts`** — typed data file with `key`, `shortName`, `description`, `examples.{weak,strong}`, `appliesAt[]` per rule. Currently a 15-entry SCAFFOLD with every `shortName: "TBD"` — no real content.
3. **UI** — shaping_sheet step exposes `rules_applied` selection. Chunk 4.5d-3 rebuilt the Shaping Sheet (shape-labels, color tokens, "moves & improves" callout, non-blocking "once you use it, you lose it" repetition nudge) but deliberately left `rules_applied` unwired pending rule content. Note: `lib/actions/shaping.ts` still carries a stale comment claiming `lib/jswp-grammar-rules.ts` "isn't built" — the stub now exists; fix that comment when wiring the UI.
- **Identified:** chunk 4.6a (and CLAUDE.md §1 since project inception); source-discrepancy confirmed chunk 4.5d-3
- **Priority:** **content-blocked**, not engineering-blocked. Engineering effort is small once content exists. Before production cutover (Phase 7).

### Clone-forward on writing return
When teacher returns a submission, clone all artifacts (`body_paragraphs`, `t_charts`, `chunks`, `concrete_details`, `commentary_items`, `gathering_cds_sheets`, `candidate_cds`, `shaping_sheets`, `shaping_chunk_outputs`, `paragraph_forms`, `essay_parts`, `final_drafts`) to `draft_number=2` so the original submission is preserved as a snapshot. Currently chunk 4.7a stays on `draft_number=1` through revision loops — students edit the same row, so the original submission state is overwritten on save. Phase 5+ feature; meaningful for grade history and revision-comparison views.
- **Identified:** chunk 4.7a (commit `fe41809`)
- **Priority:** Phase 5+; not load-bearing for the basic submit/revise loop

### Inline-anchored teacher feedback
`teacher_feedback.target_kind` enum supports 13 target types (`student_writing`, `prompt_decoding`, `gathering_sheet`, `candidate_cd`, `body_paragraph`, `t_chart`, `chunk`, `concrete_detail`, `commentary_item`, `shaping_sheet`, `paragraph_form`, `essay_parts`, `final_draft`). Chunk 4.7b implemented only `target_kind='student_writing'` (whole-writing). Inline anchoring would let teachers click a specific artifact (e.g., a CD or a thesis) and leave a comment scoped to it. UX work: click-to-anchor on each artifact type, popover composer, persistent comment indicators on the read-only review surface, student-side surfacing on the matching step pages. Schema is ready; UX is the lift.
- **Identified:** chunk 4.7a (commit `fe41809`)
- **Priority:** Phase 5+ territory

### Combined view refetches annotations 3x per page render
The teacher review combined view (chunk 4.7b) reuses the student step components verbatim (Option A composition). Several of those components fetch `text_annotations` independently — `decode-prompt`, `gather-cds`, and `t-chart` each call `getAnnotations(writingId)` during their server render. Negligible at typical class scale (small array, RLS-cached). If profiling shows it as a hot path, extract presentational components and a unified `getWritingForReview()` query that fetches annotations once and threads through.
- **Identified:** chunk 4.7b
- **Priority:** Phase 7 perf pass; not blocking

### Mobile teacher review surface
Currently the combined view + feedback panel are desktop-first (`md:` breakpoint with a 22rem sticky right rail). On narrow viewports the layout stacks but the feedback panel ends up at the bottom — far from where the teacher is reading. A drawer-based mobile experience (toggle button to open/close the feedback panel as an overlay) plus a condensed action bar would make grading on a tablet pleasant. Polish ticket; not blocking.
- **Identified:** chunk 4.7b
- **Priority:** Phase 7 polish

### ⚠ Confirm expository essay-frame wording with Dr. Louis (gate before master)
Chunk 4.5f-4 built mode-aware expository thesis frames + intro openers + a "Flip the Prompt" helper, transcribed from the 2024 Expository guide pp.117–122. The student-facing **wording is provisional** and needs Dr. Louis's sign-off before merge to master. Specifically confirm: (1) the thesis frame labels/help ("Open thesis" / "Framed thesis — name each body paragraph"); (2) whether expository wants a **dedicated `framed` enum value** (any paragraph count) rather than reusing `three_pronged` — if yes, that's an enum `ADD VALUE` migration + an option-value change; (3) the "Flip the Prompt" template + example wording; (4) the five intro opener labels (`historical_background`, `current_event`, `quotation`, `question_problem`, `startling_fact`). Also still open: a true 3-section intro **scaffold** (perspective → say more → thesis as separate inputs) and a narrow→broad **conclusion** pyramid (pp.126–128) — 4.5f-4 added hints/help text but not separate section inputs.
- **Identified:** chunk 4.5f-4 (split out of the two closed essay-frame review items)
- **Priority:** **pedagogy-gated** — confirm before merge to master (Phase 7)

---

## Deferred chunk work

_(none currently)_

---

## Closed

### Shaping Sheet: five-move revision checklist
Added a non-blocking five-move self-check to the Shaping Sheet (`cd-cm-shaping-bp-pane.tsx`), under the "Move and improve" callout: add transitions / vary openings / vary sentence types / fix mechanics / add-delete for voice (2024 guide glossary pp.151–152). Persists to a new `shaping_sheets.revision_moves TEXT[]` (migration `0024`), kept separate from `rules_applied` (reserved for the 15 Grammar Rules). Optimistic toggle, reverts on error; read-only (disabled) in teacher review. Expository/argumentation/literary panes; narrative pane is a possible follow-up.
- **Closed:** chunk 4.5f-5 (migration 0024 — NEEDS live Supabase apply)

### Essay frames: mode-aware expository thesis + intro
Made the shared `EssayPartForm` essay steps mode-aware. Expository thesis now offers Open / Framed (name each body paragraph) with a beginner "Flip the Prompt" template helper; expository intro offers historical-background / current-event / quotation / question-or-problem / startling-fact with an inverted-pyramid hint (2024 guide pp.117–122). Argumentation/literary/narrative option sets unchanged. No migration — "framed" reuses `three_pronged`, openers are free strings (`introduction_hook_kind` is VARCHAR). `KindSelect` keeps a stored out-of-list value selectable; `ThesisStep` now receives `mode` at both call sites. **Student-facing wording is provisional** — see the Open item "Confirm expository essay-frame wording with Dr. Louis."
- **Closed:** chunk 4.5f-4 (no migration; wording gated before master)

### Read & Annotate: Main Idea capture
Added a `main_idea` annotation kind (migration `0023`, enum `ADD VALUE`). It leads the kind dropdown and renders with a dark-underline treatment echoing the guide's "underline the main idea in black" (Finding the Main Idea, 2024 guide pp.52–53). The student's paraphrase uses the existing `text_annotations.note` field — no new column. `VALID_KINDS` allowlist + `groupByKind` (now seeded from `ANNOTATION_KIND_ORDER`) updated. Range-underline approach, not a dedicated sheet-style panel — if the prominent title→main-idea→2-CDs panel is wanted later, that's a separate larger chunk.
- **Closed:** chunk 4.5f-3 (migration 0023 — NEEDS live Supabase apply)

### Decode-the-Prompt: Background / Trigger / Task decomposition
Added `background_text`, `trigger_text`, and `cd_source` (the "where will I find my concrete details?" answer) to `prompt_decodings` (migration `0022`) and a "Break the prompt into its parts" section above the Task field in `decode-prompt-step.tsx`. Captures the guide's three-part decode (2024 Expository guide pp.135–139). All nullable; autosave + Continue gate (Task only) unchanged. Shared across all four modes' decode step; teacher-review mapping in `combined-view.tsx` updated too.
- **Closed:** chunk 4.5f-2 (migration 0022 — NEEDS live Supabase apply)

### TLCD support on CDs (Expository T-Chart)
Wired the "Mark as quotation" toggle + Lead-in / Citation fields + a read-only embedded-quotation preview (`lead-in "quote" (citation)`) into the Expository T-Chart via a shared `CdEditor` in `expository-chunk-grid.tsx`, backed by the new `setConcreteDetailQuotation` action (non-destructive toggle-off) and the `transitional_lead_in` / `source_citation` columns now returned by `getTChartData`. Available on both 2+:1 (`CdCmRow`) and 3+:0 (`CdCell`). Mirrors the guide's 2+:1 T-Chart (2024 Expository guide p.79). Argumentation/literary mirroring split into the Open entry "Mirror TLCD quotation UI into `cd-cm-t-chart.tsx`."
- **Closed:** chunk 4.5f-1

### Drag-and-drop reordering of selected candidates
Added a drag handle (`@dnd-kit/sortable`) to selected candidates on the gathering sheet and persist `selection_order` on drop via the new `reorderSelectedCandidates` server action. The PRIORITY list renders selected CDs as a sortable list with display-position priority badges (1..N, decoupled from stored `selection_order` so deselection gaps never surface); the BRAINSTORM list holds unselected candidates. Keyboard reorder fallback via `KeyboardSensor`. Same chunk also restructured the gather-cds surface from per-BP tabs to stacked per-BP cards. `selection_order` has no unique constraint (only `(gathering_sheet_id, position)` does), so the contiguous 1..N rewrite loop is collision-safe.
- **Closed:** chunk 4.5e

### Legacy `/dashboard/**` route stubs (35 files)
Deleted the 35 v1 dashboard route files. 17 top-level (analytics, teachers, users/, schools/, settings, test, classes/create, assignments/create + 4 modes) and 18 per-step pages under `assignments/[id]/`. The v1 components in `components/dashboard/*` they imported remain — separately dead code, not in scope.
- **Closed:** commit `69ba8b2` (`chore(phase-7.1): delete legacy v1 dashboard routes (35 files)`)

### Legacy `__tests__/auth-*.test.tsx` files
Deleted `auth-basic`, `auth-flow`, `auth-integration` tests + their `tsconfig.json` excludes. All three targeted v1 client-side patterns (`AuthProvider`, `signInWithPassword`, `onAuthStateChange`, `/api/auth/signout`). None tested universal concerns reused by v2.
- **Closed:** commit `ca0461c` (`chore(phase-7.1): delete legacy v1 auth tests`)

### RLS hardening: `assignments_teacher_own`
Tightened the policy via migration `0009` to also require `district_id = auth_user_district_id()` and `school_id = auth_user_school_id()`. Added a defense-in-depth test case in `__tests__/schema/rls.test.ts` that probes a service-role-inserted row where `teacher_id` matches but tenancy diverges.
- **Closed:** commit `a677724` (`feat(phase-7.1): tighten assignments_teacher_own RLS`)

### `createCandidate` race on `(gathering_sheet_id, position)`
Wrapped the SELECT-max-then-INSERT in a 3-attempt retry loop catching `error.code === '23505'`. On collision, refetches `max(position)` and retries.
- **Closed:** commit `771145c` (`fix(phase-7.1): retry createCandidate on 23505 unique-violation`)

### Vendor chunk bloat from `splitChunks: 'all'`
Custom webpack `splitChunks` config in `next.config.js` was producing oversized vendor bundles. Restoring Next.js's default code-splitting reduced first-load JS substantially.
- **Closed:** commit `38b0530` (`perf(phase-2): restore Next.js default code-splitting`)

### Refactor `narrative-t-chart.tsx` Discovery section out
The 5 narrative_* fields (kind, subject, key_word, general_ideas, concrete_example) moved from t-chart's Discovery section to the new `narrative.discovery` step UI. Data stayed on `t_charts` — only UI surface relocated. T-chart now shows a read-only "From your discovery" header above the WOW section.
- **Closed:** chunk 4.5c

### Define `--jswp-*` CSS custom properties in `globals.css`
Chunk 6.6a's CSS pass shipped the full palette plus role-pointer aliases (`--jswp-color-ts`, etc.) and the `.jswp-*` class definitions with shape-symbol `::before` content for accessibility. Closes the long-standing carryover from chunk 4.3.
- **Closed:** commit `5e07520` (`feat(phase-6.6a): color-coded exemplars — rendering + sanitization`)

### Dead v1 components in `components/dashboard/**`, `components/auth/**`, `components/analytics/**`, `hooks/`
84 file deletions across the dashboard PascalCase tree (root + analytics + assignments + classes + schools + students + teachers + users), the legacy auth modal + provider components, the standalone analytics SessionTrackingProvider, and the two `useSessionTracking` hooks that only fed it. Two `components/super-admin/*` orphans (ClientSuperAdmin + SuperAdminSidebar) also went — both were self-referenced only. The remaining `components/super-admin/*` files (UsersList, DistrictsClientPage, DistrictDetailsView, EditDistrictForm, DistrictAdminManager) plus `components/dashboard/analytics/AnalyticsDashboard.tsx` stay; B4 (super-admin cleanup) will close them.
- **Closed:** chunk P7-5a

### Legacy `lib/sanitization.tsx` + `app/api/errors/route.ts` stubs
v1 browser-only DOMPurify wrapper (5 importers all in the P7-5a deletion set) plus the placeholder error-reporting route handler that referenced never-set env vars and a non-existent Supabase table. ErrorBoundary's fire-and-forget POST now 404s silently via `.catch(console.error)`. Real error sink stays behind D3 (Sentry vs homegrown `error_logs` table — Raymond's call post-cutover).
- **Closed:** chunk P7-5b

### Unnumbered legacy SQL files in `migrations/`
24 v1 apply-once patches deleted (e.g., `fix-rls-auth-performance.sql`, `add-prompt-field.sql`, `database-setup.sql`). All were folded into the canonical numbered schema long ago. Git history preserves them. Migrations directory is now just the 17 numbered files (`0001` → `0017`) + `README.md`.
- **Closed:** chunk P7-5c

### B4: Legacy `app/super-admin/**` cleanup
Path A: deleted the v1 super-admin route tree entirely. 26 file deletions, 7,230 lines: 12 routes under `app/super-admin/`, 5 components under `components/super-admin/`, the lone `AnalyticsDashboard.tsx` (only consumer was `/super-admin/analytics`), 7 backing API routes under `app/api/super-admin/districts/*` and `app/api/analytics/dashboard`, and `lib/redirect-handler.ts` (v1 client-side role redirect helper, zero imports). District provisioning continues via Supabase SQL Editor until a future chunk rebuilds the surface under `/admin/` — tracked in the new Open entry "Rebuild district management UI under `/admin/districts`."
- **Closed:** chunk P7-6 (commits `021e09f`, `4b8e14d`, `a0ad753`)
