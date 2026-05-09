# CLAUDE.md — JSWP Online Rebuild Brief

> Read this file end-to-end before doing any work. It is the single source of truth for the rebuild's scope, conventions, and current state. When in doubt, this file wins over instinct.

---

## 1. What this project is

**JSWP Online** is the official web app for the Jane Schaffer Academic Writing Program — a structured writing pedagogy (concrete details / commentary / topic sentence / concluding sentence, in specific ratios) used in K-12 schools nationwide. The program is run by Dr. Deborah Louis at Louis Educational Concepts in Dallas, Texas. The marketing site is `janeschaffer.com`. Districts buy the program and their teachers use this app to assign and grade student writing.

The legacy app (`master` branch, `jswp-online.vercel.app`) works but was built **differently from how the program is actually taught** in the printed guides. It collapsed several distinct teaching artifacts (Decoding the Prompt, Reading & Annotating, T-Chart, Shaping Sheet, Paragraph Form) into combined screens and stored student work in JSONB blobs keyed by `step1..step7`. We're rebuilding so the app **mirrors the printed guides step for step**.

### Owner and product context

- **Repo owner:** Raymond Jenkins (`jinks74d`)
- **Live legacy app:** `jswp-online.vercel.app`
- **Marketing site:** `janeschaffer.com`
- **Program publisher:** Louis Educational Concepts, Dallas TX
- **Subdomain pattern (planned):** `{district}.jswponline.com` (e.g. `lacoe.jswponline.com`)

### What "faithful to the guides" means

The Jane Schaffer Program teaches writing as a sequence of **distinct pedagogical artifacts**, each with its own purpose, layout, and color code. The legacy app merged these together. The rebuild restores them as discrete steps:

```
Decode the Prompt  →  Read & Annotate the Text  →  Gather & Prioritize CDs
                                                          ↓
                                                       T-Chart
                                                          ↓
                                                  Shaping Sheet
                                                          ↓
                                                   Paragraph Form
```

Each step is its own screen, its own database table, and its own teaching moment. Students see the same artifacts on screen that they see in the printed guide. **If a UI screen disagrees with the printed guide, the guide wins.**

---

## 2. Current status

> Deferred work and Phase 7 cleanup items live in [`docs/BACKLOG.md`](docs/BACKLOG.md). When you finish a chunk, scan it for new entries (and close any you resolved).

### What's done (as of this brief)

| Layer | File | Status |
|---|---|---|
| Schema | `migrations/0001_init_jswp_schema.sql` | Drafted, validated with `pglast`. Apply to a fresh Supabase project. |
| RLS | `migrations/0002_rls_policies.sql` | Drafted. ~25 policies covering every table. |
| Storage | `migrations/0003_storage_buckets.sql` | Drafted. `district-logos` (public) + `assignment-sources` (private). |
| Seed | `migrations/0004_seed.sql` | Drafted. Demo district + school + classes + one assignment per mode. |
| Audit log | `migrations/0005_audit_log.sql` | Append-only privileged-action log. Service-role-only INSERT. First writer is roster import. |
| Step engine | `lib/jswp-modes.ts` | Drafted. Mode/step config drives the UI. Strict-TS clean. |
| Types | `lib/database.types.ts` | Hand-written to match schema (incl. `audit_log`). Regenerate via `supabase gen types` once project exists. |
| Auth actions | `lib/actions/auth.ts` | Server actions: `signIn`, `signUp`, `requestReset`, `updatePassword`, `signOut`. `useActionState`-compatible. |
| Roster import | `lib/actions/roster-import.ts` | Server actions: `parseRosterFile` (papaparse + xlsx, two-stage UX) and `importRoster` (admin client, idempotent). |
| Subdomain + branding | `middleware.ts` | Subdomain → district resolution with 60s cache. Sets 5 branding headers (request-side). |
| Branding helpers | `lib/branding-headers.ts` | `server-only`. Reads district headers, hex-validates, emits CSS vars on `<html>`. |
| Auth UI | `app/(auth)/login/`, `signup/`, `reset-password/`, `app/auth/callback/`, `app/logout/` | Login + signup + reset + logout, all on `@supabase/ssr`. |
| Admin area | `app/admin/` | `/admin` (super/district/school) with `requireRole` gate. `/admin/import/students` lives here. |
| Placeholder portals | `app/welcome/`, `app/forbidden/` | Teacher/student post-login landing until Phase 3/4. Polite role-mismatch landing. |
| Plan | `docs/DEV_PLAN.md` | 8-phase plan with definitions of done. |

### What's not done (work remaining in Phase 1)

- `lib/jswp-grammar-rules.ts` — Dr. Louis's 15 Grammar Rules with examples.
- `lib/jswp-rubrics.ts` — TypeScript types for `assignments.rubric` JSONB, default rubric per mode.
- `__tests__/schema/rls.test.ts` — RLS policy tests using two impersonated Supabase clients.
- `scripts/seed-auth.ts` — Companion to `0004_seed.sql` that creates auth.users via the Supabase admin API.
- `docs/PROGRAM.md` — JSWP method synthesis (see Section 4 for inline summary).
- `docs/ARCHITECTURE.md` — High-level system diagram.

### What comes next (priority order, locked with the user)

1. **Schema & data model** — finishing Phase 1 (above).
2. **Auth, districts, multi-tenancy** — Phase 2 in `docs/DEV_PLAN.md`.
3. **Teacher dashboard & grading** — Phase 3.
4. **Student writing flow** — Phase 4.

Build in this order. The student writing flow is the most user-visible feature but it depends on schema + auth + teacher-side assignment authoring, so it lands fourth.

---

## 3. Tech stack — locked decisions

Do not propose changes to these without explicit approval from the user:

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15.5 (App Router) | Already in use; locked. |
| Language | TypeScript 5.6, strict mode | All new code. No JavaScript files. |
| UI | React 18 + Tailwind CSS v4 | Existing app mid-transition v3→v4; rebuild standardizes on v4. |
| Data | Supabase (`@supabase/ssr` + `@supabase/supabase-js`) | No ORM. RLS-first. |
| Drag/drop | `@dnd-kit/*` | For CD reordering on the Gathering sheet. |
| Color picker | `react-colorful` | District branding. |
| CSV/Excel | `papaparse` + `xlsx` | Roster import. |
| Print | `react-to-print` | Per-step print views and final paragraph print. |
| Sanitization | `dompurify` | All student rich-text input. |
| Icons | `lucide-react` | Standard icon set. |
| Tests | Vitest + Testing Library | Already configured. |
| Hosting | Vercel | Preview deploys per PR. |
| Email | Resend | Decision in Phase 2. |
| Error tracking | Sentry | Phase 7. |

**Do not add new dependencies casually.** If you need a library not listed, propose it in a comment first and wait for approval. The legacy app accumulated dependencies that turned out to be unused.

---

## 4. JSWP method primer

The full method synthesis lives in `docs/PROGRAM.md` (when written). Inline minimum viable summary:

### The four modes and their ratios

| Mode | Ratio | Notes |
|---|---|---|
| Expository / Informational | 2+:1 | "Across the curriculum." Default mode. |
| Argumentation | 2+:1 | Optional Concession / Counterargument / Refutation. Thesis frames: open, framed-but, framed-although, three-pronged. |
| Literary / Response to Literature | **1:2+** | Different cadence — see below. |
| Narrative (Personal & Fictional) | 2+:1 | Discovery + WOW (When/Where/Who/What/Dialogue) brainstorm. |

The ratio is `CD : CM` per chunk. Expository's "2+:1" means at least 2 CDs and 1 CM per chunk. Literary's "1:2+" means 1 CD and at least 2 CMs (because literary analysis demands more interpretation per piece of evidence).

### The color code (non-negotiable)

| Color | Part | CSS variable |
|---|---|---|
| Blue | Topic Sentence, Concluding Sentence | `--jswp-blue` |
| Red | Concrete Detail | `--jswp-red` |
| Green | Commentary | `--jswp-green` |
| Black | Essay introduction / conclusion (when an essay) | `--jswp-black` |
| Yellow | Thesis (highlighter convention) | `--jswp-yellow` |
| Purple | Concession (Argumentation) | `--jswp-purple` |
| Orange | Counterargument | `--jswp-orange` |
| Teal | Refutation | `--jswp-teal` |

Students physically pick up colored pens in the classroom. The app must reinforce this visually. Every color-coded element also gets a non-color signal (icon, border pattern, screenreader label) for accessibility — see Section 9.

### Canonical step paths

**Expository:** Decode Prompt → Read & Annotate → Gather CDs → T-Chart → Shaping Sheet → Paragraph Form

**Argumentation:** + Topic Sentence Development with Pro/Con tagging; optional C/CA/R inside the T-Chart; thesis frames for essays.

**Literary (unique cadence):** Decode → Annotate → Gather CDs → **Generate single-WORD CMs** → **Make Decisions** (best word for TS, best 2 per chunk) → **Elaboration ("clouds" — phrases)** → T-Chart → Shaping Sheet → Paragraph Form

**Narrative:** Decode → Discovery (key word + brainstorm + concrete example) → Topic Sentences → T-Chart with WOW → Shaping Sheet → Intro → Conclusion → Final

The exact step list with metadata is `lib/jswp-modes.ts`. The UI step engine reads from there. **Never hard-code a step list anywhere else.**

### Cross-cutting elements

- **Dr. Louis's 15 Grammar Rules** — applied during the Shaping Sheet step. Stored in `lib/jswp-grammar-rules.ts` (when written). Referenced by `shaping_sheets.rules_applied[]`.
- **Embedding Quotations** — micro-lesson for Argumentation/Expository/Literary. A quotation needs a *transitional lead-in* (TLCD) and a *citation* — represented in the schema by `concrete_details.is_quotation`, `transitional_lead_in`, `source_citation`.
- **"Once you use it, you lose it"** — the pick-n-stitch rule on the Shaping Sheet. A CM word/phrase used in one sentence cannot be reused. Tracked by `commentary_items.used_in_*` flags.
- **Gradual Release: I Do / We Do / You Do / You Do Together** — the program's pedagogical framework. Phase 6 of the dev plan introduces "exemplar models" so teachers can publish the "I Do" example.

---

## 5. Repo conventions

### Branching

- `master` — frozen reference of the legacy app. **Do not push to master directly.**
- `v2` — active rebuild branch. Cut at Phase 0 start.
- Feature branches off `v2`, merged via PR.
- After cutover (Phase 7), `v2` merges to `master`.

### Folder layout (target)

```
/
├── CLAUDE.md                      ← this file
├── README.md                      ← rewritten in Phase 7
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── middleware.ts                  ← subdomain → district resolver (Phase 2)
│
├── app/                           ← Next.js App Router routes
│   ├── (auth)/                    ← login / signup / reset-password
│   ├── (marketing)/               ← public pages
│   ├── dashboard/                 ← teacher area (Phase 3 rebuild)
│   │   ├── classes/
│   │   ├── students/
│   │   └── assignments/
│   ├── admin/                     ← admin area: super, district, school admins
│   │   ├── import/
│   │   ├── districts/             (Phase 6)
│   │   └── users/                 (Phase 6)
│   ├── student/                   ← student writing flow (Phase 4)
│   │   ├── assignments/[id]/
│   │   └── writings/[id]/[slug]/
│   ├── welcome/                   ← placeholder until Phase 3/4 portals exist
│   ├── forbidden/                 ← role-mismatch landing
│   ├── auth/callback/             ← Supabase email-confirm code exchange
│   ├── api/                       ← only when an RPC won't do
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                        ← primitive components (Button, Input, Card)
│   ├── jswp-color/                ← color tokens + accessibility wrappers
│   ├── steps/                     ← per-step UI (one component per groupOrigin)
│   ├── step-engine/               ← shared chrome (stepper, save buttons)
│   ├── assignment-builder/        ← teacher-side assignment authoring
│   └── feedback/                  ← polymorphic comment UX
│
├── lib/
│   ├── database.types.ts          ← generated; do not hand-edit (after Phase 1)
│   ├── jswp-modes.ts              ← step engine config
│   ├── jswp-grammar-rules.ts      ← Dr. Louis's 15 rules
│   ├── jswp-rubrics.ts            ← rubric shapes per mode
│   ├── supabase/                  ← client/server/middleware factories
│   ├── auth.ts                    ← requireUser / requireRole helpers
│   ├── district-branding.utils.ts ← color tokens, contrast helpers
│   └── utils.ts
│
├── hooks/                         ← React hooks
│
├── migrations/                    ← Supabase SQL, numbered 0001…
│
├── docs/
│   ├── DEV_PLAN.md
│   ├── PROGRAM.md                 ← JSWP method synthesis
│   ├── ARCHITECTURE.md
│   └── RUNBOOK.md                 ← Phase 7
│
├── scripts/                       ← one-off scripts; idempotent
│   └── seed-auth.ts               ← creates auth.users for dev seed
│
├── __tests__/                     ← Vitest tests
│   ├── schema/                    ← RLS tests, migration tests
│   ├── lib/                       ← unit tests
│   └── components/                ← component tests
│
└── public/                        ← static assets
```

Admin and teacher dashboard are different mental models with different sidebars, so they live as siblings rather than nested.

### Naming

- **Files:** `kebab-case.ts` for everything (`gathering-cds.tsx`, not `GatheringCDs.tsx`).
- **React components:** `PascalCase` exports, `kebab-case` filenames.
- **DB tables:** `snake_case` plural (`student_writings`, not `studentWritings`).
- **DB columns:** `snake_case` (`student_writing_id`, `created_at`).
- **TypeScript types:** `PascalCase` matching the table (`StudentWritings`, `Assignments`).
- **Enums:** `snake_case` prefixed with `jswp_` in Postgres (`jswp_mode`); `PascalCase` in TS via `Database["public"]["Enums"]["jswp_mode"]`.
- **Step keys:** `mode.step_key` (e.g. `expository.gather_cds`) — dotted, lowercase, snake_case.
- **Slugs in URLs:** `kebab-case` (`/student/writings/abc/gather-cds`).

### Imports

- Use the `@/` path alias for project root (configured in `tsconfig.json`).
- Order imports: built-ins, packages, `@/` aliased, relative.
- Prefer named exports over default exports. Default exports only for Next.js page components.

### Commits

- Conventional Commits style: `feat: …`, `fix: …`, `chore: …`, `docs: …`, `test: …`.
- Reference the phase when relevant: `feat(phase-2): subdomain middleware`.
- One logical change per commit. No "WIP" or "fix typo" follow-ups.

---

## 6. Coding standards

### TypeScript

- **`strict: true`** in `tsconfig.json`. No `any`. No `@ts-ignore` without a comment explaining why.
- Always type function parameters and return types on exported functions. Interior helpers can rely on inference.
- Use `type` for unions, primitives, mapped types. Use `interface` for object shapes that may extend.
- Prefer `readonly` on arrays and props that aren't mutated.
- Use `Database["public"]["Tables"]["X"]["Row"]` (or the `Tables<"x">` alias) for DB row types — never hand-write a row type that duplicates the schema.

### Supabase access patterns

We use three Supabase client factories:

```typescript
// lib/supabase/server.ts — Server Components and Route Handlers
export async function createServerClient() { /* … */ }

// lib/supabase/client.ts — Client Components only
export function createBrowserClient() { /* … */ }

// lib/supabase/middleware.ts — middleware.ts
export function createMiddlewareClient(req, res) { /* … */ }
```

**RSC-first:** Server Components fetch data directly with the server client. Client Components only fetch when they need real-time updates or user-driven mutations. Never expose the service role key to the browser.

**Always check for errors:**

```typescript
const { data, error } = await supabase.from("assignments").select().eq("id", id).single();
if (error) {
  // log, throw, or return — never silently ignore
  throw new Error(`Failed to fetch assignment: ${error.message}`);
}
```

### RLS pattern

RLS is the source of truth for authorization. Every table has RLS enabled. Every policy uses one of the `auth_user_*()` helper functions defined in `migrations/0001_init_jswp_schema.sql` and `0002_rls_policies.sql`. **Do not write policies that re-implement scoping logic.**

If you need a new helper, add it to a new migration file (`0005_…`). Helpers are `SECURITY DEFINER` with `SET search_path = public, pg_temp`. They wrap the recursive RLS check with a single source of truth.

The pattern for a per-writing artifact table:

```sql
CREATE POLICY <table>_read ON <table>
  FOR SELECT TO authenticated
  USING (auth_user_can_read_writing(student_writing_id));

CREATE POLICY <table>_write ON <table>
  FOR ALL TO authenticated
  USING (auth_user_can_write_writing(student_writing_id))
  WITH CHECK (auth_user_can_write_writing(student_writing_id));
```

If the table is one level deeper (e.g. `concrete_details` → `chunks` → `body_paragraphs` → `student_writings`), join up to the writing in the EXISTS subquery. See examples in `0002_rls_policies.sql`.

### Error handling

- **Server Components** can throw. Next.js error boundaries catch them.
- **Client Components** display errors via toast or inline error state. Never swallow.
- **Route Handlers** return structured JSON: `{ ok: false, error: { code, message } }`.
- **Never log secrets.** Sentry's `beforeSend` strips `Authorization` and `cookie` headers.

### Forms

- Server Actions over Route Handlers when possible (Next.js 15 server actions work well).
- Validate on the server with `zod` (or hand-rolled checks). Never trust client input.
- Show validation errors next to the field, not in a banner.

### Step engine

The step engine is the centerpiece of the student writing flow. Read `lib/jswp-modes.ts` carefully before touching any student-flow code.

**The contract:**

1. The mode/step config is the only place step ordering and pedagogy hints live.
2. The router (`app/student/writings/[id]/[slug]/page.tsx`) reads the slug, looks up the step via `getStepBySlug(mode, slug)`, and renders the corresponding component.
3. Step components are dumb — they receive props from the route, render the artifact UI, and call back via Server Actions to save.
4. After save, the route navigates to `getNextStep(currentKey, visibleSteps)`.
5. `step_progress` rows track completion server-side.

**To add a new step or change the order:** edit `lib/jswp-modes.ts`. No schema migration needed. No router change needed.

---

## 7. Schema reference

The full schema is in `migrations/0001_init_jswp_schema.sql`. Key concepts:

### Pedagogical artifacts as first-class tables

Each artifact a student produces is its own table:

| Step | Tables |
|---|---|
| Decode Prompt | `prompt_decodings` |
| Read & Annotate | `text_annotations` (range-based) |
| Gather CDs | `gathering_cds_sheets` + `candidate_cds` |
| T-Chart | `t_charts` (with mode-specific extension columns), `chunks`, `concrete_details`, `commentary_items` |
| Shaping Sheet | `shaping_sheets` + `shaping_chunk_outputs` |
| Essay parts | `essay_parts` |
| Paragraph Form / Final Draft | `paragraph_forms`, `final_drafts` |

This is the structural difference from the legacy schema, where everything lived in a single `student_assignment_progress` JSONB column keyed by `step1..step7`. The legacy approach made teachers unable to comment on individual CDs, blocked per-CD analytics, and forced step counts to fit a fixed shape across modes that have very different step counts.

### Mode lives only on `assignments`

Sub-tables inherit mode through the `assignment_id → student_writing → body_paragraph → chunk` chain. The legacy schema duplicated `writing_style` on both `assignments` and `student_assignment_progress`; that's a denormalization bug we're not repeating.

### Polymorphic feedback

`teacher_feedback` has `target_kind` (enum) + `target_id` (uuid). A teacher can comment on a writing as a whole, a single CD, a CM, the T-Chart, the Shaping Sheet — anything. Always scoped to a `student_writing_id` for query speed.

### Multi-draft support

`student_writings.draft_number` is part of the unique key `(assignment_id, student_id, draft_number)`. Each draft is a separate row with its own artifacts. To create a draft 2, the application clones the artifacts forward (definition of "clone forward" lives in Phase 4).

### Step progress is config-driven

`step_progress.step_key` is a string like `expository.gather_cds`. The DB never knows the step list — `lib/jswp-modes.ts` does. Adding a new mode is a config change.

### RLS helper functions

All defined in `0001` and `0002`. Use these in policies; do not repeat the query logic:

| Function | Returns |
|---|---|
| `auth_user_role()` | The caller's role enum |
| `auth_user_district_id()` | The caller's district |
| `auth_user_school_id()` | The caller's school |
| `auth_user_teaches_class_period(uuid)` | Boolean |
| `auth_user_enrolled_in_class_period(uuid)` | Boolean |
| `auth_user_is_admin_for_district(uuid)` | Boolean (super or district admin in scope) |
| `auth_user_is_admin_for_school(uuid)` | Boolean (super, district, or school admin in scope) |
| `auth_user_can_read_writing(uuid)` | Boolean — owner, teacher, or admin |
| `auth_user_can_write_writing(uuid)` | Boolean — owner (when editable), teacher, or admin |

---

## 8. Testing strategy

### Three layers

1. **Unit (Vitest)** — pure logic in `lib/`. The step engine helpers (`getSteps`, `getNextStep`, `computeProgress`) are easy targets. Aim for 90%+ coverage on `lib/`.
2. **Component (Vitest + Testing Library)** — step components in isolation with mocked Supabase clients. Aim for the happy path of every step component.
3. **Integration (Playwright)** — happy path E2E per mode plus role-based access smoke tests.

### RLS tests are non-negotiable

`__tests__/schema/rls.test.ts` uses two Supabase service-role clients impersonating different users (via the `Authorization: Bearer <jwt>` header trick or via direct JWT signing). For every table, verify that:

- The owner can read and write their own rows.
- A user in the same scope (school) with the right role can access.
- A user in a different scope cannot access.
- An anon user cannot access anything.

If you change a policy, you change a test.

### What you don't need to test

- Generated types (`lib/database.types.ts`).
- Migration SQL syntax (the `pglast` lint catches it).
- Supabase SDK behavior (already tested upstream).

### Running tests

```bash
npm run test          # watch mode
npm run test:run      # single run
npm run test:coverage # with coverage report
```

---

## 9. Accessibility

WCAG 2.1 AA is the floor, not the ceiling. The JSWP color code is non-negotiable but it can't be the only signal. Every color-coded element gets:

1. **A border pattern** — solid for TS/CS, dotted for CD, dashed for CM, double for thesis.
2. **A small icon** — `●` (TS), `▲` (CD), `■` (CM), `◆` (thesis), positioned inline.
3. **A `<span class="sr-only">` label** with the part name.

When a district admin sets a custom primary color, validate the contrast ratio against white (`#FFFFFF`) text — should meet at least 4.5:1. Use the `getContrastRatio` helper in `lib/district-branding.utils.ts`. Warn, don't block, but warn loudly.

Keyboard navigation must work everywhere. Drag-drop on the Gathering CDs sheet has up/down keyboard fallback. Step engine "Save and Next" is reachable via Tab.

---

## 10. Print and export

Every step screen has a print stylesheet that produces a paper-faithful version of that artifact. The Final Draft has both an in-app print view (via `react-to-print`) and PDF export (browser print-to-PDF for v1).

Print views must:

- Hide chrome (nav, save buttons, hints).
- Preserve the JSWP color code (use `print-color-adjust: exact`).
- Fit on standard US Letter portrait. The T-Chart and Shaping Sheet may go landscape — set `@page { size: landscape; }` for those.
- Include a header with student name, assignment title, date, draft number.

---

## 11. Phase plan summary

The full plan with deliverables and definitions of done is in `docs/DEV_PLAN.md`. Quick reference:

| Phase | Size | Focus | Definition of done |
|---|---|---|---|
| 0. Foundation | S (~3d) | Branch, new Supabase, docs scaffolded | `npm run dev` works, env wired, branch live |
| 1. Schema & types | M (~7d) | SQL, RLS, types, mode config, grammar rules, rubrics | Migrations clean, RLS tests pass, types compile |
| 2. Auth & tenancy | M (~7d) | Supabase Auth, subdomain middleware, branding, roster import | Teacher signs up, lands on subdomain, sees branding |
| 3. Teacher dashboard | L (~12d) | Class management, assignment authoring | Teacher publishes assignment in any mode |
| 4. Student writing | L (~14d) | Step engine, all step components per mode | Student completes a writing in each mode |
| 5. Feedback & grading | M (~7d) | Polymorphic comments, rubric scoring, portfolio | Teacher grades and returns; student revises |
| 6. Admin & exemplars | M (~7d) | Super admin tools, "I Do/We Do" model library, analytics | Super admin onboards a district E2E |
| 7. Polish & cutover | M (~7d) | A11y, print, performance, production swap | Lighthouse 90+, WCAG AA, cutover complete |

Estimate: ~64 working days solo, ~32–40 with two devs.

---

## 12. Immediate next actions

In order. Do not skip steps.

### 12.1 — Provision the new Supabase project

1. Create a new Supabase project (region: `us-east-1` to match the legacy if possible).
2. Capture URL, anon key, service role key.
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. Add the same to Vercel `v2` branch env vars.

### 12.2 — Cut the `v2` branch

```bash
git checkout master
git pull
git checkout -b v2
git push -u origin v2
```

In Vercel, link the `v2` branch to a preview deployment. Verify it builds.

### 12.3 — Apply the migrations

In the new Supabase project's SQL editor, run in order:

1. `migrations/0001_init_jswp_schema.sql`
2. `migrations/0002_rls_policies.sql`
3. `migrations/0003_storage_buckets.sql`
4. `migrations/0004_seed.sql` (after creating the test auth users — see step 12.4)

### 12.4 — Create test auth users

Build `scripts/seed-auth.ts`. It uses the Supabase admin API (`createUser` with the service role key) to create the four test users referenced by `0004_seed.sql`:

- `super@demo.test` → uuid `00000000-0000-0000-0000-000000000100`, password `super-password-123`
- `teacher@demo.test` → uuid `00000000-0000-0000-0000-000000000200`, password `teacher-password-123`
- `alex@demo.test` → uuid `00000000-0000-0000-0000-000000000300`, password `student-password-123`
- `bailey@demo.test` → uuid `00000000-0000-0000-0000-000000000301`, password `student-password-123`

The Supabase admin SDK does not let you set the user UUID directly. Two options:

**Option A:** Generate the auth users first, capture the UUIDs they get, replace the placeholder UUIDs in `0004_seed.sql` with the real ones. Re-run the seed.

**Option B:** Use raw SQL to insert into `auth.users` with explicit IDs (Supabase tolerates this for dev). The script wraps it.

Option A is cleaner. Option B is faster. Pick one based on team comfort.

### 12.5 — Generate types from the live schema

After the migrations land:

```bash
npx supabase gen types typescript --project-id <new-project-id> --schema public > lib/database.types.ts
```

Compare with the hand-written file. They should be functionally identical. If the generator produces extra fields (system columns, views), keep them.

### 12.6 — Build the missing Phase 1 lib files

In this order:

1. `lib/jswp-grammar-rules.ts` — the 15 rules with examples (see Section 13 below for the source pages).
2. `lib/jswp-rubrics.ts` — rubric shape per mode.
3. `__tests__/schema/rls.test.ts` — RLS policy tests.

After these, Phase 1 is done. Move to Phase 2.

---

## 13. The 15 Grammar Rules — source

Dr. Louis's 15 Rules for Improved Grammar appear in:

- 2024 Expository Guide pp. 36–72
- 2019 Argumentation Guide pp. 22–72
- 2018 Personal & Fictional Narrative Guide pp. 26–110
- Response to Literature Quick Start Guide v4

The rules cover sentence variety, transitions, active vs. passive voice, parallel structure, "once you use it you lose it" word repetition, embedding quotations, etc. When building `lib/jswp-grammar-rules.ts`, each rule needs:

```typescript
{
  key: "rule_03",
  shortName: "Vary sentence openings",
  description: "Begin sentences with different parts of speech…",
  examples: {
    weak: "The dog ran. The dog jumped. The dog barked.",
    strong: "Sprinting across the yard, the dog leaped over the fence and barked at the squirrel.",
  },
  appliesAt: ["shaping_sheet"],   // step group_origins where this surfaces
}
```

If you don't have the printed guides on hand, **stop and ask the user before guessing the content of a rule.** It's better to leave a TODO than to invent pedagogical content.

---

## 14. Anti-patterns from the legacy app

These are mistakes the legacy app made. Do not repeat them.

### 14.1 — JSONB blobs for structured data

The legacy schema put student work in a single JSONB column on `student_assignment_progress` keyed by `step1..step7`. This made it impossible to:
- Query "all CDs across all writings in this class."
- Comment on a specific CD.
- Show analytics on which step students stall at.
- Add a new mode with a different step count.

**Use the structured tables in `0001`. Reach for JSONB only for genuinely free-form data like the rubric definition.**

### 14.2 — Step numbering coupled to schema

Columns named `step1_feedback`, `step2_feedback`, etc., bake the step list into the schema. New mode = schema migration.

**Use `step_progress.step_key` strings. Mode/step config lives in TypeScript.**

### 14.3 — Mode duplicated across tables

The legacy schema had `writing_style` on both `assignments` and `student_assignment_progress`. Same value, two places — invitation to drift.

**Mode lives ONLY on `assignments`. Sub-tables inherit through joins.**

### 14.4 — RLS policies without helper functions

The legacy app accumulated 7+ `fix-rls-*` migrations because every policy re-implemented "is this user a school admin in scope" inline, with subtle differences.

**Use `auth_user_*()` helpers. Add new helpers in numbered migrations.**

### 14.5 — Inline auth checks scattered through pages

The legacy app called `getCurrentUser()` and role-checked in many places, with subtle differences. Some pages forgot.

**Use `requireRole("teacher")` from `lib/auth.ts`. Wrap protected layouts in a single auth boundary.**

### 14.6 — Skipping Decoding the Prompt

The legacy "Enter Prompt" page was a free-text field that didn't surface task / form / ratio / key verbs. Students didn't decode; they just started.

**Decoding the Prompt is Step 1 in every mode. The screen captures structure, not free-text.**

### 14.7 — Skipping Reading & Annotating

The legacy app skipped this entirely for source-text assignments. Students went straight from prompt to CD entry.

**When `assignments.source_text IS NOT NULL`, the Annotate step is required. Range-based highlighting persisted to `text_annotations`.**

### 14.8 — Collapsing T-Chart and Shaping Sheet

The legacy app fused them into one screen. The guides treat them as **two distinct artifacts** with different purposes — the T-Chart is a planning tool; the Shaping Sheet is a revision tool.

**Two screens. Two database tables. Don't merge.**

### 14.9 — Single-attempt assignments

The legacy app didn't model multiple drafts. A student who wanted to revise had no system support.

**`student_writings.draft_number` plus `assignments.allow_multiple_drafts`. Multiple drafts are first-class.**

### 14.10 — Hard-coded color hex values

The legacy app sprinkled `#FF0000` etc. throughout components.

**Use CSS custom properties from `lib/district-branding.utils.ts` and the `JSWP_COLORS` map in `lib/jswp-modes.ts`. District color overrides go through CSS variables set on `<html>`.**

---

## 15. When you (Claude Code) should stop and ask

Most decisions you can make on your own following the conventions above. **Stop and ask the user before:**

1. Adding a new dependency to `package.json`.
2. Inventing new pedagogical content (grammar rule text, rubric criteria, hook category names).
3. Changing the step list or mode list in `lib/jswp-modes.ts`.
4. Modifying RLS helper functions or policies after Phase 1.
5. Renaming a column or table that already has data in it.
6. Deviating from the "pedagogical artifacts as first-class tables" pattern.
7. Building features marked "deferred" in the dev plan (LMS integrations, AI feedback, real-time collab, parent portal).
8. Touching the legacy `master` branch.

Otherwise, work with confidence. Read the file you're about to change. Run the tests. Ship the PR.

---

## 16. Useful commands

```bash
# Dev
npm run dev                  # next dev
npm run dev:turbo            # next dev --turbo

# Quality
npm run lint                 # next lint
npm run lint:fix             # next lint --fix
npm run type-check           # tsc --noEmit
npm run test                 # vitest watch
npm run test:run             # vitest single run
npm run test:coverage        # with coverage

# Build
npm run build                # next build
npm run build:analyze        # with bundle analyzer
npm run start                # next start

# Performance
npm run performance-audit    # lighthouse local

# Cleanup
npm run clean                # rm .next + cache
```

Before opening a PR: `npm run lint:fix && npm run type-check && npm run test:run && npm run build`. All must pass.

---

## 17. Where to look first

| Question | File |
|---|---|
| What's the schema? | `migrations/0001_init_jswp_schema.sql` |
| What are the RLS rules? | `migrations/0002_rls_policies.sql` |
| What's the step list for mode X? | `lib/jswp-modes.ts` |
| What are the TypeScript row types? | `lib/database.types.ts` |
| What's the dev plan? | `docs/DEV_PLAN.md` |
| What's the JSWP method? | `docs/PROGRAM.md` (when written) — meanwhile see Section 4 of this file |
| What did the legacy app get wrong? | Section 14 of this file |
| What conventions do we use? | Sections 5–6 of this file |

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **CD** | Concrete Detail — a fact, example, or piece of evidence. Color: red. |
| **CM** | Commentary — analysis, explanation, opinion about a CD. Color: green. |
| **TS** | Topic Sentence — opens a body paragraph. Color: blue. |
| **CS** | Concluding Sentence — closes a body paragraph. Color: blue. |
| **C / CA / R** | Concession, Counterargument, Refutation — argumentation only. |
| **TLCD** | Transitional Lead-In for a Concrete Detail (introduces an embedded quotation). |
| **Chunk** | A unit of CD + CM(s) inside a body paragraph. Ratio (e.g. 2+:1) describes a chunk. |
| **Body paragraph (BP)** | A topic-sentence-bounded paragraph containing 1+ chunks. |
| **Ratio** | CD-to-CM ratio per chunk. 2+:1 (Expository / Argumentation / Narrative), 1:2+ (Literary), 3+:0 (Summary). |
| **Pick-n-Stitch** | The Shaping Sheet technique of selecting the strongest CM phrases and weaving them into final sentences. "Once you use it, you lose it." |
| **WOW** | Web Off the Word — Narrative brainstorming structure. |
| **WOTS** | Web Off the Topic Sentence. |
| **Gradual Release** | I Do / We Do / You Do / You Do Together — the program's pedagogical scaffolding. |
| **Decode the Prompt** | Step 1 — students identify task, form, ratio, key verbs. |
| **T-Chart** | Step 4 — graphic organizer combining TS, CDs, CMs, CS into one plan. |
| **Shaping Sheet** | Step 5 — revision artifact where the T-Chart is "moved and improved" with grammar rules applied. |
| **Paragraph Form** | Final step — the assembled paragraph in color. |

---

## 19. End-of-doc checklist

If you've made it this far, before you write a line of code, confirm:

- [ ] You've read `migrations/0001_init_jswp_schema.sql` end-to-end.
- [ ] You've read `lib/jswp-modes.ts` end-to-end.
- [ ] You've read `docs/DEV_PLAN.md` for the phase you're working on.
- [ ] You know which phase you're in.
- [ ] You know the next concrete deliverable.
- [ ] You've checked the anti-patterns list (Section 14) against your plan.
- [ ] You have access to `.env.local` with the new Supabase keys.

If any of those is no, fix it first.

---

*End of brief. Last updated: Phase 1, May 2026.*
