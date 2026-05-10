# Backlog

Consolidated list of deferred work that isn't part of a current chunk. Most items are tagged for **Phase 7** (polish + production cutover) per `docs/DEV_PLAN.md`. Anything that needs attention sooner is called out by priority.

When you finish an item, move it to **Closed** with the commit hash. Don't delete — the closed list is the audit trail.

Last reviewed: chunk 4.5c.

---

## Open

### Legacy `/dashboard/**` route stubs need proper 404s or redirects
The legacy teacher dashboard surface (created pre-rebuild) still has live routes for steps and admin pages we don't intend to keep. Replace with 404s or redirects to the v2 equivalents before production cutover.
- **Identified:** pre-Phase 4 (called out in CLAUDE.md folder layout note)
- **Priority:** before production cutover (Phase 7)

### Storage upload UI failure surface
Storage upload errors currently log to console only; users see no feedback when an upload fails. Surface failures inline (toast or form-level error).
- **Identified:** pre-Phase 4
- **Priority:** before production cutover (Phase 7)

### RLS hardening: tighten `assignments_teacher_own`
The current `assignments_teacher_own` policy gates on `teacher_id = auth.uid()` only. Defense in depth: also validate `district_id` and `school_id` match the calling profile's tenancy. Belt-and-suspenders against a hypothetical leaked `auth.uid()` from a cross-tenant teacher.
- **Identified:** pre-Phase 4
- **Priority:** before production cutover (Phase 7)

### Legacy `__tests__/auth-*.test.tsx` files
`__tests__/auth-basic.test.tsx`, `auth-flow.test.tsx`, `auth-integration.test.tsx` are excluded from typecheck via `tsconfig.json`. Either rewrite for the v2 server-side auth flow or delete; lingering excludes erode signal.
- **Identified:** pre-Phase 4
- **Priority:** before production cutover (Phase 7)

### TLCD support on CDs
Schema supports embedded quotations on `concrete_details` via `is_quotation`, `transitional_lead_in`, `source_citation`. Chunk 4.4 stores CDs as plain text only. Add a "Mark as quotation" toggle on each CD; when enabled, expose the TLCD + citation fields underneath.
- **Identified:** chunk 4.4 (commit `01191de`)
- **Priority:** before production cutover (Phase 7) — pedagogically canonical per CLAUDE.md §4

### Define `--jswp-*` CSS custom properties in `globals.css`
`lib/jswp-modes.ts` exports `JSWP_COLORS` mapping to `var(--jswp-red)`, `--jswp-green`, `--jswp-yellow`, `--jswp-blue`, `--jswp-purple`, `--jswp-orange`, `--jswp-teal`. None are defined in `globals.css` yet — the values silently fall back to whatever CSS interprets. Downstream chunks (T-chart color coding, chunk composition, paragraph form) will need them once mode-color styling shows up in the UI. Tailwind utility classes carry chunks 4.3 and 4.4.
- **Identified:** chunk 4.3 (commit `972547c`); reiterated in chunk 4.4
- **Priority:** before production cutover (Phase 7); blocks any chunk that reads from `JSWP_COLORS` for runtime styling

### Two `as unknown as <Shape>` TS narrowing hacks
`lib/actions/student-writings.ts` and `lib/actions/prompt-decoding.ts` each have an `as unknown as` cast on a Supabase nested-select result because the generated `Database` types don't infer the embed shape. Likely resolves when `lib/database.types.ts` is regenerated against the live schema (per CLAUDE.md §12.5). Until then, casts work and `npm run type-check` passes.
- **Identified:** chunk 4.2 (commit `fffc3ac`)
- **Priority:** before production cutover (Phase 7); revisit after the type regen

### `createCandidate` race on `(gathering_sheet_id, position)` uniqueness
Two concurrent [Add candidate] clicks (same student, double-tab or fast double-click) can both compute the same `max(position) + 1` and one INSERT will 23505. Currently throws to the user. Fix is a 5-line retry loop catching `23505` and re-fetching max position.
- **Identified:** chunk 4.5 (commit `6881cca`)
- **Priority:** before production cutover (Phase 7); rare in practice

### Drag-and-drop reordering of selected candidates
The pedagogyHint for gather-cds says "Drag them into the order you want them to appear." Chunk 4.5 implements selection-order via toggle order (first selected = priority 1). `@dnd-kit/*` is already in `package.json`; add a drag handle to selected candidates and persist `selection_order` on drop.
- **Identified:** chunk 4.5 (commit `6881cca`)
- **Priority:** polish; before production cutover (Phase 7)

### Phrase-to-word linking on `commentary_items`
Literary's elaboration step (chunk 4.5b2) pools phrase CMs per CD via `parent_cd_id` only. The pedagogyHint says "for each CM word, write a synonym, then two phrases" — implying a 1:1 word→phrase association. Schema doesn't enforce this. Adding a `parent_cm_id UUID REFERENCES commentary_items(id) ON DELETE CASCADE` column would let elaboration link each phrase to the specific best-word it elaborates, improving pedagogical fidelity. Requires migration; not load-bearing for any current step.
- **Identified:** chunk 4.5b2 audit
- **Priority:** polish; before production cutover (Phase 7)

### Implement Dr. Louis's 15 Grammar Rules
Cross-cutting JSWP pedagogy per CLAUDE.md §1. The `shaping_sheets.rules_applied TEXT[]` column already exists in the schema for tracking which rules a student applied during shaping. Three deliverables:
1. **Content** — rule titles, descriptions, examples per rule, sourced from the printed guides (2024 Expository pp. 36–72, 2019 Argumentation pp. 22–72, 2018 P&F Narrative pp. 26–110, RTL Quick Start v4). Per CLAUDE.md §15, requires explicit user approval before invention.
2. **`lib/jswp-grammar-rules.ts`** — typed data file with `key`, `shortName`, `description`, `examples.{weak,strong}`, `appliesAt[]` per rule.
3. **UI** — shaping_sheet step exposes `rules_applied` selection (chunk 4.6a left this column unwritten because the data file isn't built yet).
- **Identified:** chunk 4.6a (and CLAUDE.md §1 since project inception)
- **Priority:** **content-blocked**, not engineering-blocked. Engineering effort is small once content exists. Before production cutover (Phase 7).

---

## Deferred chunk work

_(none currently)_

---

## Closed

### Vendor chunk bloat from `splitChunks: 'all'`
Custom webpack `splitChunks` config in `next.config.js` was producing oversized vendor bundles. Restoring Next.js's default code-splitting reduced first-load JS substantially.
- **Closed:** commit `38b0530` (`perf(phase-2): restore Next.js default code-splitting`)

### Refactor `narrative-t-chart.tsx` Discovery section out
The 5 narrative_* fields (kind, subject, key_word, general_ideas, concrete_example) moved from t-chart's Discovery section to the new `narrative.discovery` step UI. Data stayed on `t_charts` — only UI surface relocated. T-chart now shows a read-only "From your discovery" header above the WOW section.
- **Closed:** chunk 4.5c
