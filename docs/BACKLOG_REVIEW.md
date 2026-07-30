# Backlog Review — Open Items

> Snapshot generated 2026-07-02 from `docs/BACKLOG.md`. Source of truth remains `BACKLOG.md`;
> this is a grouped, priority-sorted reading of the **17 open items** (nothing under "Deferred chunk work").

---

## 🔴 Blocked on a decision (need you or Dr. Louis)

1. **Implement Dr. Louis's 15 Grammar Rules** — *content-blocked, not engineering.*
   The `lib/jswp-grammar-rules.ts` scaffold has 15 entries all `shortName: "TBD"`.
   ⚠️ CLAUDE.md §13's cited source pages are **wrong** — the rules aren't in the Expository/Narrative
   guides on disk. Need the real source (likely the 2019 Argumentation guide or RTL Quick Start v4)
   before building. `shaping_sheets.rules_applied TEXT[]` column already exists; UI is unwired pending content.

2. **Confirm expository essay-frame wording with Dr. Louis** — *gate before master.*
   Chunk 4.5f-4's thesis frames / intro openers / "Flip the Prompt" wording is provisional and needs
   sign-off. Also open: a true 3-section intro scaffold + narrow→broad conclusion pyramid.

3. **Is 3+:0 argumentation pedagogically valid?** — *blocked on pedagogy call.*
   Argumentation is commentary-driven; 3+:0 is the *summary* ratio. Decision: should the assignment
   form even offer it for argumentation? Small fix either way (likely remove the option, not special-case
   the step engine).

---

## 🟠 Blocked on tooling / infra

4. **Remove `as unknown as` TS casts (chunk P7-2)** — 34 casts across 23 files, mostly Supabase
   nested-embed narrowing. Blocked on Supabase CLI auth (`supabase login` / `SUPABASE_ACCESS_TOKEN`)
   to regenerate `lib/database.types.ts`.

---

## 🟢 Ready to build — pedagogically canonical (do before cutover)

5. **Mirror TLCD quotation UI into `cd-cm-t-chart.tsx`** — Expository already has the "Mark as quotation"
   + Lead-in/Citation fields; argumentation & literary still store CDs as plain text. `transitional_lead_in` /
   `source_citation` columns and `setConcreteDetailQuotation` action already exist — **UI-only lift.**

6. **Expository step subLabels off-by-one for 3+:0** — sidebar hard-codes "Step 1–5"; for 3+:0
   (which drops `gather_cds`) every step from T-Chart on is labelled one too high. Fix = derive numbers
   from the resolved (ratio-aware) visible-step list. Affects `lib/jswp-modes.ts` + the step sidebar.

7. **Rebuild district management UI under `/admin/districts`** — P7-6 deleted the v1 super-admin district
   CRUD; provisioning currently runs via SQL Editor. Needed before first production tenant onboarding.
   *(Note: overlaps the `/district` + `/school` admin shells built since — reconcile what's actually still missing.)*

8. **Storage upload UI failure surface** — upload errors only hit `console`; users get no feedback.
   Surface inline (toast / form-level error).

---

## 🔵 Ready to build — polish / smaller

9. **Edit a school admin's kind after creation** — no UI to change `admin_kind`; needs inline control
   on the school-admins table + audit-logged `updateSchoolAdminKind` action.

10. **Per-row `admin_kind` column in school-admins CSV import** — importer defaults everyone to
    `administrator` (`DEFAULT_ADMIN_KIND`); add an optional `admin_kind`/`role` column + per-row resolve.

11. **School-admin dashboards: real content per kind** — the three `/admin/school/{administrator,counselor,other}`
    dashboards are still scaffold shells with TODO cards. *(Product-driven — needs per-role content specified.)*

12. **Consolidate live-count textarea pattern** — chunk 4.6b inlines ~40 lines of AutoSaveInput-shaped
    code per pane for word-count; extract `<LiveCountTextarea>` or add an `onChange` prop to `AutoSaveInput`.

13. **Feedback-area grading extensions** — deferred: reconcile feedback grade with `total_score`,
    per-section weighting / auto-aggregating section grades into the overall, and 3-state
    check-plus/check/check-minus (only `✓`/`✗` today).

14. **Exemplar step-match uses persisted `current_step`, not URL `[step]`** — can briefly diverge on
    manual backward URL navigation (reference panel filters to the wrong step). Low impact.

---

## ⚪ Phase 5+ / perf (not blocking the core loop)

15. **Clone-forward on writing return** — on teacher return, clone all artifacts to `draft_number=2`
    so the original submission is snapshotted. Currently revisions overwrite `draft_number=1`.

16. **Inline-anchored teacher feedback (finer-than-step)** — step-granularity shipped; still deferred:
    per-CD/chunk/commentary anchoring via `target_kind` + `target_id`, and per-section resolve.

17. **Teacher review surface — perf + mobile**
    - *Combined view refetches annotations 3× per render* (Phase 7 perf) — decode-prompt, gather-cds,
      and t-chart each call `getAnnotations(writingId)` independently. Negligible at class scale.
    - *Mobile teacher review surface* (Phase 7 polish) — desktop-first; feedback panel stacks at the
      bottom on narrow viewports. Wants a drawer-based mobile experience.

---

## Suggested "ship now" candidates

Given the current state (school-admin tier just built out, tree green, migration 0036 live):

- **#5 (mirror TLCD UI)** — canonical and UI-only, plumbing already in place.
- **#6 (subLabel off-by-one)** — small, self-contained correctness fix.
- **#7 (district management)** — worth reconciling against the `/district` + `/school` shells already shipped
  before scoping fresh work.
