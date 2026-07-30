# Per-Section + Overall Teacher Feedback — Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); pending implementation plan
- **Branch:** v2
- **Related:** `docs/BACKLOG.md` → "Inline-anchored teacher feedback" (this is the
  step-granularity first slice of it)

---

## 1. Problem

On the teacher's review surface (the stacked read-only `CombinedView` of a
student's submitted writing) there is exactly **one** feedback box — the
whole-writing threaded panel in the right rail. Teachers want to comment
**per section** (Decode, Annotate, T-Chart, Shaping, Paragraph Form, …) **and**
leave an overall comment at the end. Today everything collapses into the single
whole-writing thread, so a teacher can't attach a remark to the specific step it
refers to.

The schema already anticipated this: `teacher_feedback` carries
`target_kind` (enum) + `target_id` (uuid), and only `target_kind='student_writing'`
is wired. But the enum is **artifact-typed** (`t_chart`, `shaping_sheet`,
`paragraph_form`, `concrete_detail`, …) and has **no kind** for several steps
(`annotate_text`, `topic_sentence_dev`, the literary steps, `thesis`,
`introduction`, `conclusion`). So anchoring "per section" to the enum would not
cover every step in every mode.

## 2. Goals / Non-goals

**Goals**
- One editable feedback **note per section** (a section = a visible step), authored
  by the teacher on the review surface.
- An **overall** feedback box (the existing threaded panel) moved to the **end** of
  the page.
- The student **sees** each section note on the matching step page when the writing
  is returned/graded.

**Non-goals (deferred)**
- Finer-than-step anchoring (per-CD, per-chunk, per-commentary). The
  `target_kind`/`target_id` columns remain for that future slice.
- Per-section **resolve** workflow. Section notes are simple text; the resolve loop
  stays on the overall thread.
- Multi-teacher concurrency niceties beyond the per-teacher uniqueness constraint.

## 3. Anchoring model — `step_key`

A "section" is a **step**, identified by its `step_key` (e.g.
`expository.t_chart`). Step keys are the app's canonical, config-driven section
identifiers (`lib/jswp-modes.ts`), and they exist for **every step in every mode**
— unlike the artifact-typed `target_kind` enum. This keeps the feature
config-driven (CLAUDE.md §14.2: no behavior hard-coded outside the step config).

- **Section note:** `target_kind='student_writing'`, `target_id=<writing id>`,
  `step_key='<step.key>'`, `body=<text>`.
- **Overall comment:** `step_key IS NULL` (unchanged from today).

## 4. Data model — migration `0030`

```sql
ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS step_key TEXT NULL;

-- Exactly one section note per (writing, teacher, step).
CREATE UNIQUE INDEX IF NOT EXISTS ux_teacher_feedback_section
  ON teacher_feedback (student_writing_id, teacher_id, step_key)
  WHERE step_key IS NOT NULL;
```

- Overall rows keep `step_key NULL`; the partial index excludes them, so the
  existing multi-comment thread is unaffected.
- `step_key` is free text (a step key string), not an enum — adding a step never
  needs a migration.

## 5. Server actions

`lib/actions/teacher-feedback.ts`:

- **`upsertSectionFeedback(writingId: string, stepKey: string, body: string): Promise<void>`**
  - `requireRole('teacher')` (plus the existing write authorization via RLS).
  - Trim `body`. If empty → **delete** the section row for
    `(writing, current teacher, stepKey)` (clearing a note removes it).
  - Otherwise **upsert** on the partial-unique key
    `(student_writing_id, teacher_id, step_key)`, setting `target_kind='student_writing'`,
    `target_id=writingId`, `body`.
  - `revalidatePath` the writing review path.
- **`addWritingFeedback`** (overall) — unchanged; writes `step_key NULL`.

## 6. Queries

`lib/queries/teacher-feedback.ts`:

- Add `step_key: string | null` to `FeedbackItemRow` and the `listFeedback`
  select. `listFeedback` already returns **all** rows for a writing; the
  CombinedView will fetch once and group by `step_key`.
- New pure helper `groupSectionFeedback(rows): { byStep: Map<string, FeedbackItemRow>; overall: FeedbackItemRow[] }`
  — section notes keyed by `step_key`, overall = `step_key === null`. (Section map
  holds at most one per step per the unique index; if duplicates ever appear, keep
  the newest.)

## 7. Teacher UI

`components/dashboard/writing-review/combined-view.tsx` + new
`components/dashboard/writing-review/section-feedback-note.tsx`:

- CombinedView fetches feedback once, groups it, and passes each step's note down.
- Under each step `<section>`, render **`SectionFeedbackNote`** (client):
  - Single textarea pre-filled with the existing note `body` (or empty).
  - Autosave on blur + explicit Save; status indicator (saving / saved / error).
  - Empty + save → delete (via `upsertSectionFeedback` with empty body).
  - Labeled (e.g. "Feedback on this section"), visually distinct from student content.
- The **overall** threaded `FeedbackPanel` moves from the sticky right rail to the
  **end** of the stacked sections under an "Overall feedback" heading. The review
  page layout drops the 3-column rail in favor of a single column + trailing panel.

## 8. Student UI

- On the student's matching step page (the `_steps/*` components already render in
  read-only mode via `WritingModeProvider`), show the teacher's **section note**
  for that step, **read-only**, when `status ∈ {returned, graded}`.
- Implementation: a small read-only `SectionFeedbackNote` variant (or shared
  component in read-only mode) that displays the note text with a teacher/icon
  label. Fed by the same `listFeedback` grouping.
- The overall thread continues to surface via the existing student `FeedbackPanel`
  with its `Mark resolved` affordance. Section notes have no resolve (non-goal).

## 9. RLS

No policy change. `teacher_feedback` read/write policies already gate by writing
access (`auth_user_can_read_writing` / teacher-can-grade). `step_key` is a
descriptor column on an already-scoped row. The partial unique index is the only
DB-level addition.

## 10. Testing

- **Unit:** `groupSectionFeedback` (section vs overall split; one-per-step;
  newest-wins on accidental dup).
- **Action:** `upsertSectionFeedback` insert → update (same key replaces, doesn't
  duplicate) → empty-body delete.
- **RLS:** existing `teacher_feedback` tests still pass; add a case that a section
  note (with `step_key`) obeys the same read/write scoping as a whole-writing row.

## 11. Build order

1. Migration `0030` (+ apply to live v2 DB); add `step_key` to `Database` types and
   `FeedbackItemRow`/`listFeedback`.
2. `upsertSectionFeedback` action; `groupSectionFeedback` helper.
3. `SectionFeedbackNote` component; wire into `CombinedView`; move overall panel to
   the end (review page layout change).
4. Student-side read-only section notes on step pages.
5. `npm run type-check`; unit/action tests.

## 12. Risks

- **Layout change** moving the overall panel out of the right rail touches the
  teacher review page wrapper; verify the feedback still reads well and the
  mobile/desktop layout holds.
- **Student-side surfacing** is the largest piece; if it needs to be split, ship
  teacher authoring first (steps 1–3) and student viewing (step 4) as a follow-up
  — but the design treats them as one feature since unseen feedback is useless.
