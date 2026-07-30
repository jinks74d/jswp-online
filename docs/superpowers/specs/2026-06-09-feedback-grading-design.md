# Feedback-Area Grading (number / letter / check) — Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); pending implementation plan
- **Branch:** v2
- **Builds on:** the per-section teacher feedback feature
  (`docs/superpowers/specs/2026-06-09-per-section-teacher-feedback-design.md`)

---

## 1. Problem

The teacher review surface now has per-section feedback notes plus an overall
threaded panel, but no quick **grade**. Teachers want to drop a fast mark on each
section and on the writing as a whole, in one of three formats: a **number**, a
**letter**, or a **check/X**. This is a lightweight, formative layer — **separate**
from the existing formal final grade (the green "Mark graded" button → rubric
scoring / `student_writings.total_score`), which stays exactly as-is.

## 2. Decisions (locked during brainstorming)

1. **Scope:** grades attach **both per-section and overall**.
2. **Format:** chosen **once per writing** — Number, Letter, or Check. Every section
   mark and the overall grade use that one format; switching it switches all inputs.
3. **Relationship to the final grade:** **independent / additive.** This feature does
   NOT touch the rubric / `total_score` / "Mark graded" / `graded` status path.

## 3. Data model — migration `0031`

```sql
CREATE TYPE jswp_grade_format AS ENUM ('none', 'number', 'letter', 'check');

-- Per-writing format + the single overall grade (writing-level).
ALTER TABLE student_writings
  ADD COLUMN IF NOT EXISTS grade_format jswp_grade_format NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overall_grade TEXT NULL;

-- Per-section grade rides on the section note row (the (writing, teacher,
-- step_key) anchor from migration 0030).
ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS grade_value TEXT NULL;
```

- `grade_format = 'none'` (default) means grading is off; no grade inputs render and
  no grades show to the student.
- All grade values are stored as **TEXT**; `grade_format` tells the UI how to
  render/validate them: a number string (`"92"`), a letter (`"B+"`), or a check token
  (`"check"` / `"x"`).
- **Section grade** lives on `teacher_feedback.grade_value` on the section note row
  (`step_key` set). It is meaningful only on section rows; overall thread rows
  (`step_key IS NULL`) leave it null.
- **Overall grade** lives on `student_writings.overall_grade` (writing-level — it does
  not belong to any single thread comment).

## 4. Value scales — `lib/grade-format.ts` (pure, unit-tested)

```ts
export const LETTER_GRADES = [
  "A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F",
] as const;

export type GradeFormat = "none" | "number" | "letter" | "check";

// Validates a stored value against the active format. Empty string = "cleared".
export function isValidGrade(format: GradeFormat, value: string): boolean { /* … */ }
//  - number: a finite number 0–100 (after trim)
//  - letter: one of LETTER_GRADES
//  - check : "check" or "x"
//  - none  : only "" is valid

// Display helper: renders the stored value for read-only badges.
export function formatGradeLabel(format: GradeFormat, value: string): string { /* … */ }
//  - check → "✓" / "✗"; number/letter → the value as-is; none/"" → ""
```

These are generic grading conventions (not JSWP-specific pedagogy), so no content
approval is needed.

## 5. UI

### 5.1 `GradeInput` component (teacher, editable)
One component renders the control for the active `grade_format`:
- `number` → `<input type="number" min=0 max=100>` (compact).
- `letter` → `<select>` of `LETTER_GRADES` + a blank "—" to clear.
- `check`  → two small toggle buttons `✓` / `✗`; clicking the active one clears.
- `none`   → renders nothing.

Saves via a passed `onSave(value: string)` (autosave on change/blur). A `readOnly`
variant renders a small **badge** (`formatGradeLabel`) and nothing when empty.

### 5.2 Grade-format bar (teacher)
A compact selector at the **top** of the review content (above the first section):
"Grade format: ( None · Number · Letter · Check )". Sets `student_writings.grade_format`
via `setGradeFormat`. When `none`, all grade inputs are hidden.

### 5.3 Section grade (teacher)
`SectionFeedbackNote` (teacher mode) renders a `GradeInput` beside the note when
`grade_format !== 'none'`, saving via `setSectionGrade(writingId, stepKey, value)`.

### 5.4 Overall grade (teacher)
The "Overall feedback" area gains a `GradeInput` (one per writing) saving via
`setOverallGrade(writingId, value)`, shown when `grade_format !== 'none'`.

### 5.5 Student (read-only)
- Each section page shows the section grade as a read-only badge beside the
  (existing) read-only section note, when the writing is `returned`/`graded` and
  `grade_format !== 'none'`.
- The overall grade renders as a read-only badge in the student's feedback panel area.

## 6. Actions

`lib/actions/feedback-grades.ts` (or extend `teacher-feedback.ts`):
- `setGradeFormat(writingId, format)` → `student_writings.grade_format`. `requireRole(TEACHER_ROLES)`.
- `setOverallGrade(writingId, value)` → `student_writings.overall_grade` (validated; empty clears to null).
- `setSectionGrade(writingId, stepKey, value)` → upsert the section `teacher_feedback`
  row setting `grade_value`. Row lifecycle: a section row persists when it has a note
  **or** a grade; it is deleted only when **both** `body` and `grade_value` are empty.
  Therefore both `setSectionGrade` and the existing `upsertSectionFeedback` must, after
  writing their own field, delete the row only if the *other* field is also empty.

All revalidate the writing's review path + the student path (same as the feedback
actions).

## 7. Queries

- `FeedbackItemRow` gains `grade_value: string | null`; `listFeedback` selects it.
- The teacher review writing query + the student writing query return
  `grade_format` and `overall_grade` from `student_writings`.
- The student `[step]` page reads the section row's `grade_value` (already grouping
  feedback via `groupSectionFeedback`).

## 8. RLS

No policy change. `grade_value` is a new column on the already-scoped
`teacher_feedback`. `grade_format` / `overall_grade` are columns on `student_writings`
— the **teacher-writable** path must be allowed: confirm `student_writings` UPDATE by
the grading teacher is permitted by the existing policies (the "Mark graded" flow
already updates `student_writings.total_score`/`status`, so teacher UPDATE on the
writing is established; `setGradeFormat`/`setOverallGrade` reuse that path).

## 9. Independence from the formal grade

This feature never reads or writes `total_score`, `rubric_scores`, or the `graded`
status. The green "Mark graded" button, `ReviewActions`, `RubricScoringPanel`, and
`GradeComposer` are untouched.

## 10. Testing

- **Unit:** `lib/grade-format.ts` — `isValidGrade` per format (number bounds, letter
  set membership, check tokens, none) and `formatGradeLabel`.
- **Action:** section-row lifecycle — grade-only row persists; clearing grade with a
  note present keeps the row; clearing both deletes it.
- **RLS:** existing `teacher_feedback` + `student_writings` tests still pass (no policy
  change).

## 11. Build order

1. Migration `0031` (+ apply live); `jswp_grade_format` + the three columns into types.
2. `lib/grade-format.ts` + unit tests (TDD).
3. Actions: `setGradeFormat`, `setOverallGrade`, `setSectionGrade`; adjust
   `upsertSectionFeedback` delete-guard.
4. Queries: `grade_value` on `FeedbackItemRow`/`listFeedback`; `grade_format` +
   `overall_grade` on the writing queries.
5. `GradeInput` component (editable + readOnly badge).
6. Teacher wiring: grade-format bar; section `GradeInput` in `SectionFeedbackNote`;
   overall `GradeInput` in the Overall feedback area.
7. Student wiring: section + overall read-only badges.
8. `npm run type-check`; unit/action tests.

## 12. Non-goals (deferred)

- Reconciling the feedback grade with the formal `total_score` / rubric (locked
  independent).
- Per-mark format mixing (locked: one format per writing).
- Per-section resolve / weighting / auto-aggregating section grades into the overall.
- Check-plus/check/check-minus (3-state) — `✓`/`✗` only, per the request.
