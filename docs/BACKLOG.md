# Backlog

Consolidated list of deferred work that isn't part of a current chunk. Most items are tagged for **Phase 7** (polish + production cutover) per `docs/DEV_PLAN.md`. Anything that needs attention sooner is called out by priority.

When you finish an item, move it to **Closed** with the commit hash. Don't delete — the closed list is the audit trail.

Last reviewed: chunk P7-1. Expository guide-fidelity review 2026-05-27 added 5 Open items (Decode 3-part, Annotate Main Idea, thesis frames, intro pyramid, Shaping 5 moves) and enriched "TLCD support on CDs."

---

## Open

### `0047` was never applied — `district_logos_public_read` is still live
Found 2026-08-16 by the new orphan check in `db:check`, immediately after the same class of miss put `0046` in production unapplied (see Closed). `0047`'s entire body is one `DROP POLICY district_logos_public_read ON storage.objects` — it creates nothing — so there was no declaration for the checker to miss and it reported clean for months.

Currently harmless in practice: the `district-logos` bucket is **empty** (verified with the service role, 0 objects), so there is nothing to enumerate. It stops being harmless the moment a district uploads a logo, at which point any client with the anon key can `list()` the whole bucket rather than fetching one object by URL — which is exactly what `0047` was written to prevent.

**Do not apply `0047` blind.** Its own header carries a warning: it must land with or after the route change that accompanies it, or logos break for every non-admin user. That route change (`app/api/districts/[districtId]/logo/route.ts` redirecting to `districts.logo_url` instead of `.download()`-ing through the RLS-respecting client) appears to be in the tree already — confirm before applying, then re-run `db:check` and watch the orphan line clear.
- **Identified:** 2026-08-16, by the orphan check added the same day
- **Priority:** medium — latent until the first logo upload, then it is a public bucket listing

### `db:check` cannot see privileges at all
There is no `grants` category and no inventory key to build one from, so any migration whose body is only `GRANT`/`REVOKE` passes unnoticed whether or not it was ever applied. `0046` was precisely that migration, and on 2026-08-16 it had never been applied while `db:check` reported no drift — `anon` could call `__schema_inventory()` and read every policy's `USING` clause (see Closed). `db:check` now prints a standing `! privileges (GRANT/REVOKE) are NOT checked` note so the gap is at least visible in the output.

Fix: extend `__schema_inventory()` with a `grants` key — `proname`, `grantee`, `privilege_type` from `information_schema.routine_privileges` for `public` functions, and the same for table privileges — then have `db-check.ts` compare against the `GRANT`/`REVOKE` statements the migrations declare. The parsing is easy; the modelling is not, because a `REVOKE` is an assertion about an *absence* and the replay currently only tracks presence.

Worth pairing with the related trap: Supabase ships `ALTER DEFAULT PRIVILEGES` granting `EXECUTE ON FUNCTIONS` in `public` to `anon`, `authenticated` and `service_role`, so **every** `SECURITY DEFINER` function created there is callable by API clients from birth, and `REVOKE … FROM PUBLIC` does not undo it. Two migrations in this repo (`0028`, `0057`) made that exact mistake. A checker that listed public-schema functions still granted to `anon` would catch the whole class.
- **Identified:** 2026-08-16, from the `0046` exposure
- **Priority:** high — it is the one category where "not checked" and "checked and fine" have looked identical, and the miss was a live disclosure

### Finish the RLS coverage sweep (18 of 33 tables had none)
Prompted by `0056`: `teacher_feedback_student_resolve` reached production both **broken** (a self-referencing scalar subquery that raised `21000` for every student) and **insecure** (`step_key`, `grade_value` and `rubric_score` were never pinned, so a student could have rewritten their own grade) because nothing tested that table. An audit on 2026-08-13 asked how widespread that was.

**33 tables carry RLS policies; 18 had no test at all.** Fourteen of the eighteen were the student-work artifact chain, which all lean on the same two helpers (`auth_user_can_read_writing` / `auth_user_can_write_writing`) reached from four different FK depths — so a join walking to the wrong writing would hand one student another's work, and a depth-2 mistake is invisible from depth 0. That cluster plus `audit_log` is now covered (10 tests, cross-student read/write/delete/insert at every depth).

**Covered 2026-08-16** (39 tests, RLS suite 108 → 147). All four items closed:
1. ~~**`assignment_sources`**~~ — owner/enrolled-student read, cross-district read refused, unreleased hidden from students, student insert/update refused, cross-district delete refused.
2. ~~**`class_student_enrollments`**~~ — student sees only their own row (probed with a *classmate in the same period*), teacher sees their period's roster, cross-district teacher sees none, self-enrol and self-unenrol both refused.
3. ~~**`class_teacher_assignments`**~~ — teacher sees only their own pairings, cross-district teacher sees none, and both forged-pairing writes (untaught period, foreign school) refused.
4. ~~**The remaining eight artifact tables**~~ — `t_charts`, `shaping_sheets`, `shaping_chunk_outputs`, `paragraph_forms`, `essay_parts`, `commentary_items`, `text_annotations`, `step_progress`. Owner reads all eight, another student reads none at any depth, supervising teacher reads all eight, cross-district teacher and anon read none; cross-student edit refused at each depth class (via-body-paragraph, via-chunk, direct) and both WITH CHECK grafts refused.

**Item (4) was expected to be a formality and was not.** The read/write isolation held exactly as predicted — same two helpers, no surprises. But writing the tests surfaced a second-FK gap that none of the previously covered tables could have exposed, because every one of them has a single parent. See the new Open item below.

**Confirmed while covering (3) — `class_teacher_assignments_read` is unscoped for admins.** The policy reads `teacher_id = auth.uid() OR auth_user_role() IN ('super_admin','district_admin','school_admin')`, with no scope predicate on the admin branch. Probed with a district_admin in the cross-tenant fixture district: they read the demo district's pairings. Contrast `class_student_enrollments_admin_manage`, which gates on `auth_user_is_admin_for_school`.

Severity is metadata disclosure, not privilege escalation — the scope is *which teacher teaches which class period*, across all districts. It does **not** widen access to student work: `auth_user_can_read_writing`'s teacher branch runs through `auth_user_teaches_class_period`, which tests `teacher_id = auth.uid()` and is unaffected by who may SELECT this table. Writes stay correctly scoped (verified). Pinned as a DOCUMENTS test in `rls.test.ts` so the behaviour is explicit rather than accidental; tightening it is a policy change needing sign-off per CLAUDE.md §15.4.

**The seed had no `assignment_sources` rows at all.** The first draft of that block passed every negative test over an empty table — "a teacher in another district cannot read them" is trivially true when there is nothing to read. The baseline-first rule below is what caught it; the tests now seed their own rows on both a released and an unreleased assignment.

**Method note for whoever picks this up:** `__schema_inventory()` emits policy NAMES only, so the audit derived each table by matching the `<table>_<suffix>` convention against the table list. It cannot tell you a policy's *logic* is right, only that one with that name exists. Partly addressed 2026-08-16 by `0057` — `__schema_inventory()` now emits `policy_details` with `cmd` / `qual` / `with_check` — but the comparison still covers only the 83 policies that call an `auth_user_*` helper; see the Open item on that.

**Test-writing note:** seed rows through a helper that throws on error. The first draft of the artifact tests ignored the upsert result, `chunks.ratio` (NOT NULL) was missing, and the whole chain silently never existed — at which point "another student reads nothing" passed for entirely the wrong reason. A negative RLS test over absent rows proves nothing. Assert the owner CAN read before asserting anyone else cannot.
- **Identified:** 2026-08-13, from the 0056 post-mortem
- **Priority:** was high; **ready to close** — all four items covered as of 2026-08-16, 33/33 tables now have at least one test
- **Progress:** 2026-08-16 — items (1)–(4) done, RLS suite 108 → 147 tests

### ~~Two artifact tables have a second FK their policy never checks~~ — FIXED by `0058`
Found 2026-08-16 while covering item (4) of the sweep above; approved and fixed the same day by migration `0058`. Kept here rather than moved to Closed because the scope note at the end is a live limitation, not history. Both policies gated on **one** parent and left a second foreign key unconstrained:

| table | gated by | ungated |
|---|---|---|
| `shaping_chunk_outputs` | `shaping_sheet_id` → `body_paragraphs` → writing | `chunk_id` |
| `commentary_items` | `chunk_id` → `body_paragraphs` → writing | `parent_cd_id` |

So a student can insert a row hanging off **their own** gated parent while pointing the ungated column at **another student's** row. Verified live: Bailey inserted a `shaping_chunk_outputs` row on their own shaping sheet referencing Alex's chunk, and a `commentary_items` row on their own chunk referencing Alex's concrete detail. Both accepted. Pinned as two DOCUMENTS tests in `rls.test.ts`.

**Severity is referential pollution, not disclosure.** A third test pins the reason: PostgREST applies RLS to an embedded table independently of the joining row, so `select("…, concrete_details(id, text)")` across the forged FK returns `null` — Bailey holds a pointer to Alex's CD and cannot dereference it. Nothing in the app writes these columns cross-writing either. What it does allow is a student writing rows into another student's referential neighbourhood, which is worth closing before it becomes a read path: the moment any query walks *outward* from `chunks` or `concrete_details` to their children without re-checking the writing, this turns into a disclosure.

`0058` adds the second parent to each `WITH CHECK`: `shaping_chunk_outputs` now also requires `auth_user_can_write_writing` via `chunk_id`, and `commentary_items` via `parent_cd_id` (nullable, so `parent_cd_id IS NULL OR …`). The DOCUMENTS tests flipped to negative assertions, plus one asserting the ordinary same-chunk `parent_cd_id` write still works — a WITH CHECK that over-reached there would have broken every commentary write in the app.

**Two limits of the fix, both deliberate.** `WITH CHECK` only, so a row that *already* carries a cross-writing reference stays put — making `USING` stricter would leave such a row undeletable by its owner. A test seeds one through the service role and pins that it still discloses nothing. And the predicate is "the caller may write the second parent's writing", which closes the student-vs-student graft but **not** a teacher grafting across two of their own students, since `auth_user_can_write_writing` is true for both. Closing that needs a same-writing invariant in a trigger, since RLS is not an integrity mechanism and the service role bypasses it.

This is the shape the sweep was looking for and the reason item (4) was not the formality it looked like: every table covered before this one has a single parent, so no earlier test could have found it.
- **Identified:** 2026-08-16, covering RLS sweep item (4)
- **Fixed:** migration `0058` (2026-08-16); residual = the two limits above

### Apply the annotation self-heal to the flat/rich viewer too
Fixed 2026-08-12: annotations saved before `d165dd2` (2026-07-23, "strip PDF margin furniture from the annotation substrate") kept offsets into the longer pre-strip `source_text`, so highlights landed ~150 characters downstream of the words the student selected. 5 of 36 rows were affected, all `source_render_mode = 'pdf'` on one file. Repaired in place, and `lib/annotation-range.ts` now re-anchors any stale annotation at render time.

**The gap that let it happen is worth understanding**, because the same shape can recur: `pdf-source-viewer.tsx` already had a strict guard (live extraction must equal stored `source_text`, else fall back to the flat viewer). That guard covers *live-vs-stored* drift but is structurally blind to *annotation-vs-stored* drift — offsets computed against an earlier version of the same `source_text`. Both conditions held at once, which is why it failed silently rather than tripping the fallback. Any future change to `lib/pdf-text.ts` extraction has the same effect on existing rows.

Still to do:
1. **`source-text-viewer.tsx` (flat + rich paths) does not use the resolver.** It walks `source_text` with the raw stored offsets using its own first-wins segmentation. The audit found 0 mismatches for `rich`/legacy-`null` sources — the margin mask only runs in the PDF path — so nothing is broken today, and it was left alone rather than risk a regression on a clean path. Wire `resolveAnnotationRange` in when that file is next touched.
2. **Persist the heal.** The viewer re-locates on every render but never writes back, so a stale row stays stale in the database and anything else reading the offsets (T-Chart prefill, teacher review, analytics) still sees bad values. Consider a `relocated` write-back, or a startup repair.
3. **Make extraction changes offset-aware.** Any future `pdf-text.ts` change should ship with a repair pass over existing `text_annotations` in the same commit. `selected_text` is what makes recovery possible — treat it as the durable anchor and the offsets as a cache.
- **Identified:** 2026-08-12, from Raymond reporting misaligned marks
- **Priority:** (1) whenever that file is touched; (2)+(3) before production cutover (Phase 7)

### Print the *annotated* source copy (and extend print past Read & Annotate)
Shipped: `[Print source]` on Read & Annotate, beside `[Open original]`. It prints a **clean** copy — no highlights, no notes — because the printed guides have the student underline CDs and write margin notes by hand; the sheet is double-spaced with a 1.75in right gutter for exactly that. Decided with Raymond 2026-08-12 (clean-only, from a 3-way choice).

Deferred, all carved from that same decision:
1. **Annotated copy.** The student's highlights preserved in JSWP color with `print-color-adjust: exact`, a kind legend, and their margin notes listed as endnotes. Needs the §9 non-color cues (the five underline line-styles in `annotation-kind-config.ts`) to survive onto paper, since a mono printer flattens the color entirely. Useful as a study artifact or something to hand in — a different artifact from the blank sheet, not a replacement.
2. **A clean/annotated toggle** on the button, if both end up wanted.
3. **Print on the downstream reference panel.** `components/student/writing/reference-panel.tsx` shows the same sources read-only on later steps and already hosts `OpenOriginalButton`; `PrintSourceButton` is structurally compatible (`PrintableSource`) and would drop in, gated on `printMeta` the same way. Left out only because the ask was scoped to Read & Annotate.
4. **The rest of §10.** This is the app's *first* print surface — `react-to-print` had been an unused dependency and there was no `@media print` CSS anywhere. `SOURCE_PRINT_PAGE_STYLE` in `print/source-print-sheet.tsx` is now the reference pattern for the T-Chart / Shaping Sheet / Paragraph Form / Final Draft print views §10 still calls for (note those two may want `@page { size: landscape }`).

Also unverified: the actual paper output. The print dialog is native and can't be driven from an automated browser without blocking it, so the header/body composition is covered by `__tests__/components/source-print-sheet.test.tsx` but nobody has yet held the page. Worth one manual pass per render mode (`plain`, `rich`, `pdf`, `image`) before cutover.
- **Identified:** 2026-08-12, with the print-source chunk
- **Priority:** (1)+(2) product-driven; (3) trivial whenever wanted; (4) Phase 7

### `db:check` policy-logic comparison covers 83 of 94 policies
Follow-on from the `db:check` item closed 2026-08-16. `scripts/db-check.ts` now diffs the set of `auth_user_*` helpers a policy invokes live against the set its migration text declares. That covers 83 of the 94 live policies. The other **11 call no helper at all** — they compare `auth.uid()` to a column directly — so for them the comparison has nothing to diff and silently agrees:

`audit_log_read_self`, `class_student_enrollments_student_read_self`, `district_logos_public_read`, `signup_requests_read_own`, `student_writings_student_select`, `student_writings_student_update`, `teacher_feedback_student_resolve`, `teacher_feedback_teacher_delete`, `teacher_feedback_teacher_update`, `user_profiles_read_self`, `user_profiles_update_self`

**`teacher_feedback_student_resolve` is on that list**, which is the sharp end of it: that is the exact policy that reached production both broken and insecure (see the RLS coverage sweep item above). The helper-set comparison as built would **not** have caught `0056`. The 11 are not a random tail — "compares `auth.uid()` to a column" describes most of the student-facing self-access policies, which are the ones where a wrong column is both easiest to write and worst to ship.

Fix: extend the comparison to the set of column references and the presence of `auth.uid()`, not just function calls. Noisier than helpers — Postgres fully qualifies and re-quotes column references on the way in — so it likely needs a normalization pass before it can be trusted, which is why it was not bundled into the first cut. Worth also emitting `prosrc` for the `auth_user_*` helpers themselves, which have the same blind spot one level down: a policy can invoke exactly the right helper while the helper's own body has drifted.
- **Identified:** 2026-08-16, on verifying the first cut of the comparison
- **Priority:** medium — 83/94 is a real check where there was none, but the uncovered 11 are the higher-risk shape

### Drop the legacy `assignments.class_period_id` column
Migration `0050` moved assignment→class-period to a junction table (`assignment_class_periods`) so one assignment can go to several classes with a per-class due date. Following the `0040` precedent, the legacy single column stays in place and is still written (set to the FIRST selected period) so nothing breaks mid-transition. Every RLS policy and every read path now goes through the junction.

Remaining readers of the legacy column, to cut over before dropping it:
- `lib/queries/assignment-analytics.ts`, `lib/queries/student-progress.ts` — both still scope by the single period, so an assignment spanning two classes reports on one of them.
- `migrations/0001` index `idx_assignments_class_period` goes with the column.

The drop migration should also remove the `class_period_id` write from `createDraftAssignment` / `updateDraftAssignment` in `lib/actions/assignments.ts`.
- **Identified:** 2026-08-05, with the multi-class assignment work
- **Priority:** medium — nothing is broken, but the duplicated pointer is exactly the drift risk CLAUDE.md §14.3 warns about

### `assignment-sources` bucket: any teacher can delete any file in their school
`assignment_sources_teacher_write` (migration `0003`) is `FOR ALL`, which includes `DELETE`, scoped only to the `school-{uuid}/` path prefix. So any teacher can delete (or overwrite) **any** object under their own school's prefix straight from the browser client — including another teacher's uploaded source PDF or rubric document. Nothing in the app does this, but nothing in the policy stops it either.

Noticed 2026-08-05 while fixing an IDOR in the rubric-document sweep. That bug is fixed at the app layer (paths are bound to `auth.uid()` via `lib/rubric-file.ts`), but the **storage policy underneath is still school-wide**, and the older source-file path has no equivalent guard: `writeAssignmentSources` persists `source_file_path` with no validation at all, so the same forge-then-sweep shape may exist there.

Likely fix: split the `FOR ALL` policy into `INSERT`/`UPDATE`/`SELECT` scoped to the school and a `DELETE` scoped to `owner = auth.uid()` (storage.objects carries `owner`), then audit `writeAssignmentSources` for the same path-trust issue.
- **Identified:** 2026-08-05, during the rubric-document security review
- **Priority:** medium — requires an authenticated teacher account and is destructive, not a disclosure; same-school blast radius

### Rubric document: import criteria from the uploaded file
Shipped (migration `0049`): a teacher can attach the rubric as a real document — PDF / Word / Excel / CSV / OpenDocument — on `assignments.rubric_file_{path,name,mime}`. Teachers see it on the grading screen, students on the assignment page. It is a **reference artifact only**: nothing scores against it, so `rubric_scores`, the grading panel, and criterion analytics still need the structured `rubric` JSONB typed in by hand.

Not built: parsing the uploaded file into structured criteria. Every parser is already a dependency (`xlsx` from roster import, `mammoth` from source upload, `pdfjs-dist`), so the work is the mapping and the review UX, not new packages. Difficulty splits sharply by format:
- **.xlsx / .csv** — a real grid. Criteria as rows × levels as columns (or transposed); reliably parseable.
- **.docx** — `mammoth` yields HTML; rubrics are nearly always a `<table>`, so the structure survives.
- **.pdf** — text extraction drops the table grid. Best-effort at most, and the teacher must review every cell before saving.

Whatever the format, the import should prefill `RubricEditor` for the teacher to correct rather than write straight to the column.
- **Identified:** 2026-08-05, alongside the rubric-document upload
- **Priority:** teacher-time saver, not a blocker — the document alone already removes the "where is the rubric" problem

### `district-logos` bucket allows listing (needs an app change, not just SQL)
Supabase's database linter flags `district_logos_public_read` (migration `0003`) as a broad `SELECT` policy on `storage.objects` that lets any client **list** every file in the public `district-logos` bucket, not merely fetch a known object URL.

The linter's remediation — drop the policy — **would break every district logo**, and that is worth writing down before someone acts on the warning. `components/ui/DistrictLogo.tsx:42` renders `<img src="/api/districts/{id}/logo">`, and that route (`app/api/districts/[districtId]/logo/route.ts`) uses the RLS-respecting `createServerClient()` plus `.download()` — the *authenticated* storage path, which consults RLS — rather than the public CDN URL. Without the policy, only super/district admins (who hold `SELECT` via the `FOR ALL` write policies) would still see logos. Teachers and students would not.

RLS cannot fix this alone: `list()` and `download()` are both `SELECT` on `storage.objects`, so no policy can permit one and deny the other.

Two real options:
1. **Redirect instead of proxy.** Change the route to 302 to the public object URL that `lib/district-branding.types.ts:113` already builds, then drop the read policy. The bucket is `public = TRUE`, so those URLs are already fetchable by anyone — no security regression, and it removes a Lambda invocation per logo render. Preferred.
2. **Proxy with the service role.** Keep the route but use the admin client (bypasses RLS), then drop the read policy. Keeps the indirection; costs a service-role call on a public asset.

Either way the policy drop belongs in the *same* change as the app fix, never before it.
- **Identified:** 2026-07-30, Supabase security advisor run during the v2 → master cutover
- **Priority:** low (information disclosure is limited to logo filenames, which are a deterministic `district-{uuid}/logo.{ext}`); do it alongside any other work in that route

### Feedback-area grading: error feedback + deferred extensions
Shipped (chunk feedback-grading, 2026-06-09): per-writing `grade_format` (number/letter/check) on `student_writings` (migration `0031`), a grade on each section (`teacher_feedback.grade_value`) and one overall grade (`student_writings.overall_grade`), with read-only badges for the student. Independent of the formal rubric/`total_score`/"Mark graded" flow. Spec/plan: `docs/superpowers/specs/2026-06-09-feedback-grading-design.md`, `docs/superpowers/plans/2026-06-09-feedback-grading.md`.
Deferred: ~~(1) **error feedback** on the grade controls~~ — **DONE** (2026-06-12): `GradeInput` and `GradeFormatBar` now show an inline `⚠ Not saved` alert (`role="alert"`) on a failed save instead of only `console.error`. (The separate app-wide "Storage upload UI failure surface" gap remains open below.) (2) Reconciling the feedback grade with `total_score` (locked independent during design). (3) Per-section weighting / auto-aggregating section grades into the overall. (4) Check-plus/check/check-minus (3-state) — `✓`/`✗` only today.
- **Identified:** chunk feedback-grading
- **Priority:** polish; before production cutover (Phase 7)


### School-admin dashboards: real content per kind
The three school-admin dashboards (`/admin/school/{administrator,counselor,other}`, added with migration `0026`) are **scaffold shells** — each renders a role header + two `TODO` placeholder cards (`app/admin/school/_dashboard.tsx`). All three kinds share the same `school_admin` RLS permissions; the kind only selects the landing page. Fill in the actual tiles/links each role should surface (e.g. Administrator: teachers/classes/import; Counselor: students/progress). Decided with Raymond 2026-06-08: scaffold now, content later.
- **Identified:** chunk school-admin-roles (migration 0026)
- **Priority:** product-driven; whenever the per-role content is specified

### Edit a school admin's kind after creation
`admin_kind` is set at creation (the "Add an admin" form's Role dropdown) and backfilled to `administrator` for pre-0026 rows. There's no UI to **change** an existing admin's kind — would need an inline control on the school-admins table + an `updateSchoolAdminKind` action (audit-logged). Small lift; deferred since creation-time assignment covers the common case.
- **Identified:** chunk school-admin-roles
- **Priority:** polish

### Per-row `admin_kind` column in the school-admins CSV import
CSV-imported school admins all default to `administrator` (`school-user.ts` passes `DEFAULT_ADMIN_KIND`). Add an optional `admin_kind`/`role` column to the importer (alias + `resolveAdminKind` per row) so a roster can set Counselor/Other in bulk. Mirrors the form's Role dropdown.
- **Identified:** chunk school-admin-roles
- **Priority:** polish

### Is 3+:0 argumentation pedagogically valid? (assignment-form question)
Chunk 4.5d-1 made the Expository flow ratio-aware: 3+:0 (summary) drops the discrete Gathering & Prioritizing CDs step, and the 3+:0 CM-correctness fixes (zero starter CM slots, no CM rows in the T-Chart, Shaping gate skips the CM requirement) are keyed on per-chunk `chunk.ratio`, so they apply to **any** 3+:0 chunk regardless of mode. But `omitForRatio` is set only on `expository.gather_cds` — so an Argumentation assignment set to 3+:0 lands in a "partially correct" interim state: it gets the CM fixes but keeps its `gather_cds` step. The real question is upstream, not "extend `omitForRatio` to `argumentation.gather_cds`": **should the assignment form offer 3+:0 for Argumentation at all?** Argumentation is inherently a commentary-driven mode (you can't argue with zero commentary) — 3+:0 is the *summary* ratio. If 3+:0 argumentation isn't a real JSWP use case, the fix is to remove that option from the `assignment-form.tsx` ratio dropdown for `mode = "argumentation"` (the `assignments` CHECK constraint could also be tightened), not to special-case the step engine. Needs a pedagogy call from Dr. Louis / Raymond before either path.
- **Identified:** chunk 4.5d-1
- **Priority:** before production cutover (Phase 7) — small, but blocked on a pedagogy decision

### Exemplar step-match uses persisted current_step, not URL [step]
6.5's per-step exemplar tagging filters by `writing.current_step` (the persisted column updated on save / `navigateToStep`). The student writing flow URL `[step]` segment is the actually-displayed step. They align on every normal navigation (sidebar clicks fire `navigateToStep` before the route change), but a backwards URL navigation by hand could briefly diverge — student lands on the thesis URL while `current_step` is still `paragraph_form`, and the reference panel filters to paragraph_form. Reconcile by either passing `[step]` down through the layout via a context the page populates, or by reading the URL on the page level and re-fetching exemplars there. Low impact in practice; tracked so a Phase 7 audit doesn't miss it.
- **Identified:** chunk 6.5
- **Priority:** polish; before production cutover (Phase 7)


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

### Cross-district analytics surface (super-admin)
Also carved out of the reconciliation. `/admin` dashboard + `/district/analytics` are stubs/ComingSoon. Deferred until the per-assignment analytics shape from chunk 5.2 has stabilized; a cross-district view will likely reuse those card components. Unchanged from the original deferral.
- **Identified:** chunk P7-6; carved out 2026-07-02
- **Priority:** deferred behind chunk 5.2 analytics

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

### Inline-anchored teacher feedback (finer-than-step)
`teacher_feedback.target_kind` enum supports 13 target types (`student_writing`, `prompt_decoding`, `gathering_sheet`, `candidate_cd`, `body_paragraph`, `t_chart`, `chunk`, `concrete_detail`, `commentary_item`, `shaping_sheet`, `paragraph_form`, `essay_parts`, `final_draft`).

**Done (chunk per-section-feedback, 2026-06-09):** the **step-granularity** slice. A new `teacher_feedback.step_key` column (migration `0030`) anchors one editable note per step; the teacher review surface renders a `SectionFeedbackNote` under each step, the overall threaded panel moved to the end of the page, and the student sees each section note read-only on the matching step page when returned/graded. Anchored by `step_key` (config-driven, covers every step in every mode) rather than the artifact-typed `target_kind`. Spec: `docs/superpowers/specs/2026-06-09-per-section-teacher-feedback-design.md`.

**Still deferred:** (1) **finer-than-step anchoring** (per-CD / per-chunk / per-commentary) using the artifact-typed `target_kind` + `target_id` columns — click-to-anchor on a specific artifact, popover composer, persistent indicators; (2) **per-section resolve** (section notes are simple text today; the resolve loop lives only on the overall thread).
- **Identified:** chunk 4.7a (commit `fe41809`); step-granularity shipped chunk per-section-feedback
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
- **Ready to send (2026-07-02):** a sign-off packet with the exact on-screen wording + 9 numbered questions (Q1–Q9, covering all four confirmations + the two scaffold design questions) is in `docs/essay-frame-signoff-packet.md`. Hand it to Dr. Louis; her ✅/edits map straight back to the step files. Blocked only on her review.
- **Identified:** chunk 4.5f-4 (split out of the two closed essay-frame review items)
- **Priority:** **pedagogy-gated** — confirm before merge to master (Phase 7)

---

## Deferred chunk work

_(none currently)_

---

## Closed

### `__schema_inventory()` was callable by `anon` in production
Closed 2026-08-16 by migration `0059`. Found by a code review of `f94895f` that flagged the missing role-named REVOKE as a fresh-rebuild risk; probing the live database showed it was not a risk but a current state.

The anon key — which ships in the browser bundle — could call `/rest/v1/rpc/__schema_inventory` and receive all 94 policies with full `qual` and `with_check`, 30 function names and 42 triggers. Verified with the key from `.env.local` (role claim `anon`, and genuinely anon: it read zero rows from `user_profiles`). `authenticated` had it too, confirmed as both a student and a teacher.

`0046` exists to close exactly this and had **never been applied**. Nothing in `migrations/` drops the function and `CREATE OR REPLACE` preserves a function's ACL, so a revoke that had ever run would still be in force. `0059` re-applies it, naming the roles, and is idempotent.

Three things worth carrying forward:
- **`REVOKE … FROM PUBLIC` does not do what it reads like.** It removes only the implicit PUBLIC grant; Supabase's `ALTER DEFAULT PRIVILEGES` gives `anon`/`authenticated`/`service_role` their own explicit grants at CREATE time, which survive untouched. `0028` and `0057` both made this mistake.
- **`0057` widened the payload before anyone checked who could read it.** Pre-`0057` an anon caller got policy names; post-`0057`, every policy's `USING` and `WITH CHECK`. The lesson is not "don't emit policy logic" — it is that adding a field to a `SECURITY DEFINER` function is a disclosure change, and the grant is part of the review.
- **The checker reported "no drift" against a database missing a security migration.** Now tracked as its own Open item.
- **Closed:** migration `0059` (2026-08-16)

### `db:check` compares policy NAMES only, and emits no triggers at all
Both blind spots closed 2026-08-16 by migration `0057` + a rewrite of `scripts/db-check.ts`.

`__schema_inventory()` (migration `0028`) built its `policies` array from `pg_policies.policyname` and nothing else, and returned no `triggers` key whatsoever. So a policy whose logic was wrong passed with a clean ✓ — found 2026-08-05 reviewing `0050`, where the committed `assignment_class_periods_write` constrains only `assignment_id` while live also enforced a period-side check, with `db:check` reporting 94/94 throughout (`0051` reconciled the file). And after `0054` the four `trg_touch_writing_*` **functions** were verifiable while the 14 `touch_writing` **triggers** that attach them were not, from any tooling in the repo — a trigger that was never attached looks identical to a working one.

`0057` extends `__schema_inventory()` with `triggers`, `trigger_details` and `policy_details` (`cmd` / `qual` / `with_check`). Purely additive and still `SECURITY DEFINER` with EXECUTE locked to `service_role`, so an older checker keeps working against a database carrying it. `db-check.ts` now replays migrations **in statement order**, applying drops as it goes, and reports `triggers: 20/20` plus a policy-logic warning block.

Three things that turned up in the build and are worth remembering:
- **Ordered replay was load-bearing, not tidiness.** Collecting all creates and all drops separately and applying drops last deletes exactly the policies that `DROP POLICY IF EXISTS x; CREATE POLICY x …` redefines — this repo's standard idiom. That silently dropped the checked count 94 → 80 while still reporting ✓.
- **Nine long-standing "missing" objects were deliberate retractions**, not drift: three `jswp_chunk_ratio` values replaced by `0038`, five `assignments.source_*` columns removed by `0041`, and a `pg_temp` helper scoped to one session. `db:check` had been exiting 1 on every run, which is how a checker stops being read.
- **The dynamic triggers are enumerable after all.** `0054` attaches `touch_writing` by looping `TEXT[] := ARRAY[…]` literals, so the parser resolves all 14 table names exactly rather than falling back to a `*.touch_writing` wildcard — a wildcard passes when 1 of 14 attachments exists, which is the same silent no-op the item was about. `0001`'s `set_updated_at` loop iterates an `information_schema` query and genuinely cannot be recovered from the file; it stays a wildcard.

Residual gap tracked separately as an Open item: the helper-set comparison covers 83 of 94 policies.
- **Closed:** migration `0057` + `db-check.ts` rewrite (2026-08-16)

### Cross-district user listing for super-admin
Shipped 2026-07-02 at `/admin/users` (super-admin only). Read-only cross-tenant listing — name/email search + role and district filters over every user in every district, with User / Role / District / School / Created columns and Total / Districts / Admins / Teachers stat cards. No provisioning here (that stays in `/admin/districts` + `/admin/signups`). New `lib/queries/all-users.ts` (`listAllUsers`, mirrors `district-users.ts` with a district embed); page re-gates to `super_admin`; RLS `user_profiles_super_admin_all` already permitted the cross-tenant read (no migration). Nav link added to `admin-nav.tsx` (super-admin only). Live-DB join verified (18 demo users resolve district/school names); `__tests__/components/all-users-view.test.tsx` (5 tests: default rows + admin/district counts, search, role filter, district filter, districtless "No district"). type-check + build + tests green.
- **Closed:** cross-district user list (2026-07-02)

### Product decision — 2-POC ceiling for district admins
Resolved 2026-07-02 (Raymond): **two POCs is the intentional ceiling.** District admins = primary + secondary POC, managed via `createDistrict`/`updateDistrict`/`inviteDistrictPoc`. No "add an Nth district admin" table will be built in the super-admin UI. The `/admin/signups` approval flow (editable role → `district_admin`) remains the escape hatch for a rare extra admin, not the primary model. Documented in the `lib/actions/districts.ts` header so future work doesn't re-open it without a fresh decision. No code/UI change — confirmation only.
- **Closed:** product decision (2026-07-02)

### Orphaned lib helpers after the v1-API sweep
Traced the dead-code island the sweep exposed (2026-07-02). Deleted 5 fully-unreferenced files: `lib/api-client.ts`, `lib/async-handler.ts` (only `api-client` used it — and the deleted `analytics/enhanced` route), `lib/performance-monitor.ts`, `lib/performance-react.tsx`, `components/DevTools.tsx` (0 importers each; internal cross-refs only). **Kept** `lib/performance.ts` and `lib/monitoring.ts` — both live: `monitoring.ts` imports `./performance` (a **relative** import that the `@/lib/` alias grep missed — nearly deleted `performance.ts` before catching it), and `monitoring.ts` has live importers (`lib/errors.ts`, `lib/auth-cache.ts`, `lib/queries/school-assignments.ts`, the school assignments views). The originally-flagged `lib/api-handler.*` never existed (a phantom 0-match). type-check + build green.
- **Closed:** v1-API sweep — lib follow-up (2026-07-02)

### Auth REST routes `auth/session` + `auth/signout` (v1 dead code)
Dedicated auth check (2026-07-02) confirmed both are dead: the **only** references anywhere are in the `.next/` build cache (compiled artifacts + generated route types) — **zero source references** in app/components/lib/hooks/middleware/callback. The v2 auth flow is fully independent: logout goes through `app/logout/route.ts` (v2 `createServerClient` → `signOut`) and `components/auth/logout-button.tsx` (`signOutAction` server action from `lib/actions/auth.ts`); session handling is `@supabase/ssr` cookie-based + middleware refresh, so the v1 "client POSTs its session to `/api/auth/session` to sync" pattern is obsolete. Deleted both. `app/api` is now 3 live routes (`districts/[districtId]/logo`, `health`, `logs`). type-check + build green.
- **Closed:** v1-API sweep — auth follow-up (2026-07-02)

### Sweep the orphaned v1 API route surface
Deleted **20 orphaned v1 `app/api/**/route.ts` handlers** (2026-07-02), each verified 0-caller across the repo (app/components/lib/hooks/middleware/tests/config): the 10 v1-`@/lib/supabase`-barrel routes (`analytics/session/start`, `dashboard/classes/{create,[id]/assign-teacher,[id]/enroll-student}`, `dashboard/users/{create,[id]/edit}`, `debug/{profile,user-profile}`, `districts/[districtId]/settings`, `schools/[schoolId]/settings`); the 4 CSV `school-admin/{classes,students}/bulk-upload(-sheets)` routes (superseded by `lib/csv-import` server actions); the 3 dead v1 analytics routes (`analytics/enhanced`, `analytics/session/{activity,end}` — same feature as the deleted SessionTrackingProvider, P7-5a); and 3 inline-`@supabase/ssr` REST routes superseded by v2 server actions/queries (`assignments`, `student-progress`, `teacher-feedback`). App/api went 25 → 5 routes. **Kept:** `districts/[districtId]/logo` (live — DistrictLogo), `health` (external monitors), `logs` (lib/logger). **Held back** (carved to Open items): the two `auth/*` routes (high-blast-radius, need an auth-specific check) and possible newly-orphaned lib helpers. type-check + build green (build first — deletions leave stale `.next/types` until regenerated).
- **Closed:** v1-API sweep (2026-07-02)

### Storage upload UI failure surface
Reconciliation 2026-07-02 found the live path already handled: the only real storage-upload UI in v2, `components/assignments/source-text-upload.tsx`, surfaces failures inline — `setError` on both the archival-failure branch and the catch (rendered red at the field), plus an amber `role="status"` warning for image-only PDFs. The CSV importer (`app/admin/import/students/import-form.tsx`) likewise shows a `role="alert"` error + per-row errors. The only console-only storage `.upload()` errors left lived in two **orphaned v1 logo-upload routes** (`app/api/districts/[districtId]/upload-logo`, `app/api/schools/[schoolId]/upload-logo`) with zero v2 caller — branding takes a `logo_url` text input, not a file upload. Deleted both routes rather than surfacing errors on dead code. Type-check + build green. The wider orphaned v1 API route cluster this exposed is carved into a new Open item ("Sweep the orphaned v1 API route surface").
- **Closed:** storage-upload reconciliation (2026-07-02) — 2 dead routes removed; live UIs already surfaced errors

### Rebuild district management UI under `/admin/districts`
Reconciliation 2026-07-02 (`docs/scope/district-management-reconciliation.md`) found the item ~80% already delivered — the v1 CRUD P7-6 deleted was rebuilt under `/admin/districts` (commits `e40efb9`, `8333bc4`, `3959987`, `7d9032e`): list/detail/create/edit, branding (logo + primary/secondary colors, hex-validated), dual POC, and district-admin provisioning via the two-POC model + `/admin/signups` approvals — all RLS-scoped and audit-logged. The two remaining slices were carved out as their own Open items (cross-district user listing; cross-district analytics, still deferred), plus a product question about the 2-POC ceiling. Original "rebuild the deleted CRUD" framing retired as obsolete.
- **Closed:** reconciliation 2026-07-02 (superseded by carved-out items)

### Expository step subLabels off-by-one for 3+:0 (was dead config)
Investigation (2026-07-02) found the premise stale: `StepConfig.subLabel` ("Step 1"…"Step 8", "Final Step") was populated in `lib/jswp-modes.ts` but **read by nothing** — `step-sidebar.tsx` renders only `step.label`, no numbers, and the only place a step number is shown to students (the Expository T-Chart header band) already computes it ratio-aware via `getExpositoryTChartSpec` (3 for 3+:0, 4 for 2+:1). So the "sidebar shows the wrong number" never actually happened; the wrong numbers only lived latently in unused config. Resolution: removed the dead `subLabel` field entirely (28 value lines + the interface member + its JSDoc; −30 lines), eliminating the latent-wrong numbers by construction rather than computing them. If step numbers are ever wanted in the sidebar, derive them from the resolved ratio-aware visible-step list at that point. No consumer/test referenced `subLabel`; type-check + `jswp-modes`/`expository-t-chart-spec` tests green.
- **Closed:** subLabel-cleanup (2026-07-02)

### Mirror TLCD quotation UI into argumentation + literary T-Charts
Extracted the Expository `CdEditor` (Mark-as-quotation toggle + Lead-in/Citation fields + embedded-quotation preview) into a shared `components/student/writing/t-chart/cd-editor.tsx` and wired it into `chunk-editor.tsx`'s `CdRow`, so argumentation and literary CDs now get the same Embedding-Quotations affordance instead of plain text. UI-only — the `is_quotation` / `transitional_lead_in` / `source_citation` columns, the mode-agnostic `setConcreteDetailQuotation` action, and the typed query fields were all already in place. `expository-chunk-grid.tsx` now imports the shared component (no visual change; −141 net lines from the dedup). Read-only teacher-review path keeps the preview and disables the controls. New `__tests__/components/cd-editor.test.tsx` (5 tests: reveal, persist, preview compose, non-destructive toggle-off, read-only). Scope: `docs/scope/mirror-tlcd-ui.md`. Follow-up (not blocking): browser-verify the read-only teacher-review render on a returned argumentation/literary writing.
- **Closed:** mirror-tlcd-ui chunk (2026-07-02)

### Phrase-to-word linking on `commentary_items`
Implemented by the Literary WOW-fidelity chunk (migration `0032`): `commentary_items.parent_cm_id UUID REFERENCES commentary_items(id) ON DELETE CASCADE` links each elaboration phrase to the best CM word it elaborates, and `synonym TEXT` stores WOW box #2. The Elaboration step now webs per best word (synonym + 2+ phrases), the Continue gate requires 2+ phrases per best word, and Shaping pick-n-stitch groups phrases under their word. Plan: `docs/superpowers/plans/2026-06-22-literary-wow-fidelity.md`.
- **Closed:** Literary WOW-fidelity chunk (2026-06-22)

### Keyboard creation of a NEW annotation over the PDF canvas (WCAG-AA close-out)
PDF-annotate decision 1 — make the PDF text layer itself keyboard-operable (no "view as text" toggle). Span-navigation selection mode in `pdf-source-viewer.tsx` (`5169ae0`, spec `docs/superpowers/specs/2026-06-22-pdf-keyboard-selection-design.md`): single tab stop (`role="application"`, `aria-activedescendant`), roving cursor moves by word (←/→) / line (↑/↓) / Home-End, Shift+Arrow extends from an anchor, Enter commits via the shared `emitSelection` path (same `SelectionPayload`, `lastEmittedRef`-deduped against the trailing `selectionchange`), Esc collapses/exits; dashed sky marquee + polite live region. Mouse + debounced selection paths and the offset model untouched. Foundation (keyboard-operable highlights + debounced modality-agnostic selection + scanned-PDF Continue-gate unblock) shipped in `9baad99`. **C3 browser-verify PASSED 2026-06-22** (owner): keyboard-only creation end-to-end with caret-browsing OFF, no double popover, marquee/cross-page scroll, screen-reader smoke (`role="application"` not hostile — `grid` fallback not needed), inert in readOnly/scanned/error. The Read & Annotate step is WCAG-AA complete for PDF sources. Known follow-up (not blocking): popover focus hand-off is a DOM query across rAF retries rather than a ref (the popover lives in sibling `annotate-text-client.tsx`).
- **Closed:** PDF-annotate decision 1 (2026-06-22) — C2 `5169ae0`, C3 verified

### PDF extraction: separator heuristic edge cases
Refined `buildPdfText`'s `separatorBetween` (`lib/pdf-text.ts`): a line/region break check now runs before the horizontal-gap test — a `y`-jump test (footer page numbers, `"LLC38"`→`"LLC 38"`) and a backward-`x` test (column/heading boundaries, `"WritingCOPYRIGHT"`→`"Writing COPYRIGHT"`), emitting a space (not a newline) so line structure isn't over-asserted. Separator alphabet (`\n`/` `/``) and offset bookkeeping unchanged → contiguity invariant holds by construction (new mixed-path contiguity test; 23/23 pass). Thresholds derive scale from mean glyph width (no glyph-height field on `PdfTextItem`); tight (<1 glyph) multi-column layouts would need a true column-segmentation pass — out of scope. NB: changes `source_text` for *new* uploads (forward-only); pre-change stored PDFs would now mismatch the live extraction and the render-side guard degrades them to the flat viewer (still annotatable) — negligible per the no-stored-PDFs data reality.
- **Closed:** PDF-annotate polish (2026-06-22)

### Warn the teacher when a PDF source is image-only (unannotatable)
Shipped: `source-text-upload.tsx` shows a non-blocking amber `role="status"` warning when an uploaded PDF has no extractable text (`extracted.renderMode === "pdf" && extracted.text.trim() === ""`) — advises swapping in a text-based PDF, but save still proceeds. Pairs with the runtime Continue-gate unblock (`9baad99`). This is the *prevention* half of PDF-annotate decision 2.
- **Closed:** PDF-annotate decision 2 (2026-06-22)

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
