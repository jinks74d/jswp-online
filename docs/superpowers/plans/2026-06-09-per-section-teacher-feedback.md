# Per-Section Teacher Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher leave one editable feedback note per section (step) on the review surface, with the existing threaded overall panel moved to the end; the student sees each section note read-only on the matching step page.

**Architecture:** Feedback rows gain a `step_key` column (migration 0030). A section note is a `teacher_feedback` row with `step_key` set; the overall thread keeps `step_key NULL`. A full unique index on `(student_writing_id, teacher_id, step_key)` enforces one note per section per teacher (NULLs are distinct, so multiple overall rows remain legal) and supports an upsert `onConflict`. A pure helper groups rows into per-step + overall; the teacher `CombinedView` renders an inline note under each step; the student step page renders the matching note read-only.

**Tech Stack:** Next.js 15 App Router (RSC + server actions), Supabase (`@supabase/ssr`, RLS-first), TypeScript strict, Vitest, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-06-09-per-section-teacher-feedback-design.md`

> **Refinement vs spec §4:** the spec proposed a *partial* unique index (`WHERE step_key IS NOT NULL`). This plan uses a **full** unique index on `(student_writing_id, teacher_id, step_key)` instead. Rationale: Postgres treats NULLs as distinct in a unique index, so multiple overall rows (`step_key NULL`) are still allowed — identical "one note per section" behavior — while a full index (unlike a partial one) is a valid `ON CONFLICT` inference target for the PostgREST upsert. Same semantics, working upsert.

---

## File Structure

- `migrations/0030_teacher_feedback_step_key.sql` — **create.** The column + unique index.
- `lib/database.types.ts` — **modify.** Add `step_key` to `TeacherFeedback`.
- `lib/section-feedback.ts` — **create.** Pure `groupSectionFeedback` helper.
- `__tests__/lib/section-feedback.test.ts` — **create.** Unit tests for the helper.
- `lib/queries/teacher-feedback.ts` — **modify.** Add `step_key` to `FeedbackItemRow` + the `listFeedback` select.
- `lib/actions/teacher-feedback.ts` — **modify.** Add `upsertSectionFeedback`.
- `components/dashboard/writing-review/section-feedback-note.tsx` — **create.** Teacher-editable / student read-only note box.
- `components/dashboard/writing-review/combined-view.tsx` — **modify.** Render a section note under each step; accept a `feedbackByStep` prop.
- `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx` — **modify.** Group feedback; pass section map to `CombinedView`; move the overall `FeedbackPanel` to the end (single column).
- `app/student/writings/[id]/[step]/page.tsx` — **modify.** Render the matching section note read-only when status is returned/graded.

---

## Task 1: Migration 0030 + Database type

**Files:**
- Create: `migrations/0030_teacher_feedback_step_key.sql`
- Modify: `lib/database.types.ts:667-676` (the `TeacherFeedback` type)

- [ ] **Step 1: Write the migration file**

Create `migrations/0030_teacher_feedback_step_key.sql`:

```sql
-- 0030_teacher_feedback_step_key.sql
-- Per-section (step-anchored) teacher feedback. A section note is a
-- teacher_feedback row with step_key set (e.g. 'expository.t_chart');
-- the overall threaded comment keeps step_key NULL. The unique index
-- enforces one section note per (writing, teacher, step). NULLs are
-- distinct, so multiple overall rows remain legal, and the full (not
-- partial) index is a valid ON CONFLICT target for the upsert.
ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS step_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_teacher_feedback_section
  ON teacher_feedback (student_writing_id, teacher_id, step_key);

COMMENT ON COLUMN teacher_feedback.step_key IS
  'Section anchor: the step key (e.g. expository.t_chart) a section note targets. NULL = overall whole-writing comment (the threaded panel). One note per (writing, teacher, step) via ux_teacher_feedback_section. Migration 0030.';
```

- [ ] **Step 2: Apply the migration to the live v2 database**

Apply via the Supabase MCP `apply_migration` tool (project_id `hcdvypzfzrzevkwkssiw`, name `teacher_feedback_step_key`) with the body of the file above. Expected result: `{"success":true}`.

If MCP is unavailable to the executor, run the same SQL in the Supabase SQL editor for project `hcdvypzfzrzevkwkssiw`.

- [ ] **Step 3: Add `step_key` to the `TeacherFeedback` type**

In `lib/database.types.ts`, change the `TeacherFeedback` type:

```ts
export type TeacherFeedback = {
  id: string;
  student_writing_id: string;
  teacher_id: string;
  target_kind: Database["public"]["Enums"]["jswp_feedback_target"];
  target_id: string;
  body: string;
  // Section anchor: step key a section note targets; NULL = overall
  // whole-writing comment (the threaded panel). Migration 0030.
  step_key: string | null;
  rubric_score: number | null;
  is_resolved: boolean;
} & Timestamps;
```

- [ ] **Step 4: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/0030_teacher_feedback_step_key.sql lib/database.types.ts
git commit -m "feat(feedback): add teacher_feedback.step_key (migration 0030)"
```

---

## Task 2: `groupSectionFeedback` pure helper (TDD)

**Files:**
- Create: `lib/section-feedback.ts`
- Test: `__tests__/lib/section-feedback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/section-feedback.test.ts`:

```ts
/**
 * Unit coverage for groupSectionFeedback — splitting a writing's
 * teacher_feedback rows into per-section notes + the overall thread.
 */

import { describe, it, expect } from "vitest";
import { groupSectionFeedback } from "@/lib/section-feedback";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

function row(partial: Partial<FeedbackItemRow>): FeedbackItemRow {
  return {
    id: "id",
    student_writing_id: "w",
    teacher_id: "t",
    target_kind: "student_writing",
    target_id: "w",
    body: "x",
    step_key: null,
    rubric_score: null,
    is_resolved: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    author: null,
    ...partial,
  };
}

describe("groupSectionFeedback", () => {
  it("splits section notes (by step_key) from overall (null step_key)", () => {
    const { byStep, overall } = groupSectionFeedback([
      row({ id: "a", step_key: "expository.t_chart", body: "tc" }),
      row({ id: "b", step_key: null, body: "overall" }),
    ]);
    expect(byStep.get("expository.t_chart")?.body).toBe("tc");
    expect(byStep.size).toBe(1);
    expect(overall.map((r) => r.id)).toEqual(["b"]);
  });

  it("keeps the newest when a step has duplicate notes", () => {
    const { byStep } = groupSectionFeedback([
      row({ id: "old", step_key: "s", created_at: "2026-01-01T00:00:00Z", body: "old" }),
      row({ id: "new", step_key: "s", created_at: "2026-02-01T00:00:00Z", body: "new" }),
    ]);
    expect(byStep.get("s")?.body).toBe("new");
  });

  it("returns empty groups for no rows", () => {
    const { byStep, overall } = groupSectionFeedback([]);
    expect(byStep.size).toBe(0);
    expect(overall).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- section-feedback`
Expected: FAIL — `groupSectionFeedback` is not exported / module not found.

- [ ] **Step 3: Write the helper**

Create `lib/section-feedback.ts`:

```ts
/**
 * Split a writing's teacher_feedback rows into per-section notes (keyed
 * by step_key) and the overall thread (step_key === null). Pure; unit-
 * tested in __tests__/lib/section-feedback.test.ts.
 *
 * At most one section note per step is expected (the unique index in
 * migration 0030 enforces it). If duplicates ever appear, the newest by
 * created_at wins.
 */

import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

export interface GroupedFeedback {
  readonly byStep: Map<string, FeedbackItemRow>;
  readonly overall: FeedbackItemRow[];
}

export function groupSectionFeedback(
  rows: readonly FeedbackItemRow[]
): GroupedFeedback {
  const byStep = new Map<string, FeedbackItemRow>();
  const overall: FeedbackItemRow[] = [];
  for (const r of rows) {
    if (r.step_key === null) {
      overall.push(r);
      continue;
    }
    const existing = byStep.get(r.step_key);
    if (!existing || r.created_at > existing.created_at) {
      byStep.set(r.step_key, r);
    }
  }
  return { byStep, overall };
}
```

> Note: importing `FeedbackItemRow` is type-only (`import type`), so the `"server-only"` guard in `lib/queries/teacher-feedback.ts` is erased at compile time and never runs in the test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- section-feedback`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/section-feedback.ts __tests__/lib/section-feedback.test.ts
git commit -m "feat(feedback): groupSectionFeedback helper + tests"
```

---

## Task 3: Surface `step_key` in the feedback query

**Files:**
- Modify: `lib/queries/teacher-feedback.ts:14-30` (`FeedbackItemRow`) and `:66-73` (the `listFeedback` select)

- [ ] **Step 1: Add `step_key` to `FeedbackItemRow`**

In `lib/queries/teacher-feedback.ts`, in the `FeedbackItemRow` interface, add `step_key` after `target_id`:

```ts
export interface FeedbackItemRow {
  id: string;
  student_writing_id: string;
  teacher_id: string;
  target_kind: FeedbackTarget;
  target_id: string;
  step_key: string | null;
  body: string;
  rubric_score: number | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}
```

- [ ] **Step 2: Add `step_key` to the `listFeedback` select**

In the same file, in `listFeedback`, add `step_key` to the selected columns:

```ts
    .select(
      `
      id, student_writing_id, teacher_id, target_kind, target_id, step_key,
      body, rubric_score, is_resolved, created_at, updated_at,
      author:teacher_id ( id, first_name, last_name )
      `
    )
```

- [ ] **Step 3: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Run helper tests still pass**

Run: `npm run test:run -- section-feedback`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/queries/teacher-feedback.ts
git commit -m "feat(feedback): return step_key from listFeedback"
```

---

## Task 4: `upsertSectionFeedback` action

**Files:**
- Modify: `lib/actions/teacher-feedback.ts` (add the action after `addWritingFeedback`)

- [ ] **Step 1: Add the action**

In `lib/actions/teacher-feedback.ts`, add after `addWritingFeedback`:

```ts
/**
 * Upsert the teacher's single section note for one step. Empty body
 * deletes the note (clearing the box removes it). One row per
 * (writing, teacher, step_key) — the unique index ux_teacher_feedback_section
 * (migration 0030) makes the upsert collision-safe and lets an edit
 * replace rather than duplicate. RLS still enforces write scoping.
 */
export async function upsertSectionFeedback(
  writingId: string,
  stepKey: string,
  body: string
): Promise<void> {
  const profile = await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const trimmed = body.trim();

  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();

  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("teacher_feedback")
      .delete()
      .eq("student_writing_id", writingId)
      .eq("teacher_id", profile.id)
      .eq("step_key", stepKey);
    if (error) {
      throw new Error(`upsertSectionFeedback delete: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("teacher_feedback").upsert(
      {
        student_writing_id: writingId,
        teacher_id: profile.id,
        target_kind: "student_writing",
        target_id: writingId,
        step_key: stepKey,
        body: trimmed,
        is_resolved: false,
      },
      { onConflict: "student_writing_id,teacher_id,step_key" }
    );
    if (error) {
      throw new Error(`upsertSectionFeedback upsert: ${error.message}`);
    }
  }

  if (writing?.assignment_id) {
    revalidatePath(
      `/dashboard/assignments/${writing.assignment_id}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors. (`step_key` is optional in the `teacher_feedback` Insert type, so the upsert object is valid.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/teacher-feedback.ts
git commit -m "feat(feedback): upsertSectionFeedback action (upsert/delete by step)"
```

---

## Task 5: `SectionFeedbackNote` component

**Files:**
- Create: `components/dashboard/writing-review/section-feedback-note.tsx`

- [ ] **Step 1: Write the component**

Create `components/dashboard/writing-review/section-feedback-note.tsx`:

```tsx
"use client";

/**
 * One section's teacher feedback note (chunk per-section-feedback).
 *
 *  - Teacher (readOnly=false): a single textarea pre-filled with the
 *    existing note. Saves on blur via upsertSectionFeedback; clearing it
 *    and blurring deletes the note. Status indicator. One note per step.
 *  - Student (readOnly=true): renders the note text read-only, or nothing
 *    when there is no note. Shown on the matching step page after return.
 */

import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { upsertSectionFeedback } from "@/lib/actions/teacher-feedback";

export function SectionFeedbackNote({
  writingId,
  stepKey,
  initialBody,
  readOnly = false,
}: {
  writingId: string;
  stepKey: string;
  initialBody: string;
  readOnly?: boolean;
}) {
  if (readOnly) {
    const text = initialBody.trim();
    if (text.length === 0) return null;
    return (
      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
          <MessageSquare className="h-3.5 w-3.5" />
          Teacher feedback
        </div>
        <p className="whitespace-pre-wrap text-sm text-gray-900">{text}</p>
      </div>
    );
  }

  return (
    <TeacherNote
      writingId={writingId}
      stepKey={stepKey}
      initialBody={initialBody}
    />
  );
}

function TeacherNote({
  writingId,
  stepKey,
  initialBody,
}: {
  writingId: string;
  stepKey: string;
  initialBody: string;
}) {
  const [value, setValue] = useState(initialBody);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const isFocusedRef = useRef(false);
  const lastSavedRef = useRef(initialBody);

  // Pick up server prop refresh when not actively editing.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialBody);
      lastSavedRef.current = initialBody;
    }
  }, [initialBody]);

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (value === lastSavedRef.current) return;
    setStatus("saving");
    try {
      await upsertSectionFeedback(writingId, stepKey, value);
      lastSavedRef.current = value;
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      console.error("section feedback save:", e);
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/60 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
          <MessageSquare className="h-3.5 w-3.5" />
          Feedback on this section
        </span>
        <span className="text-xs text-gray-500" aria-live="polite">
          {status === "saving" && "Saving…"}
          {status === "saved" && <span className="text-green-600">Saved</span>}
          {status === "error" && <span className="text-red-600">Retry?</span>}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={handleBlur}
        rows={2}
        placeholder="Leave feedback for this section (leave empty to remove)…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/writing-review/section-feedback-note.tsx
git commit -m "feat(feedback): SectionFeedbackNote component"
```

---

## Task 6: Wire section notes into the teacher review surface

**Files:**
- Modify: `components/dashboard/writing-review/combined-view.tsx` (add `feedbackByStep` prop; render note per section)
- Modify: `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx` (group feedback; single column; overall panel at end)

- [ ] **Step 1: Accept `feedbackByStep` in `CombinedView` and render the note**

In `components/dashboard/writing-review/combined-view.tsx`:

Add the import near the other imports:

```ts
import { SectionFeedbackNote } from "./section-feedback-note";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";
```

Add `feedbackByStep` to `Props`:

```ts
interface Props {
  writingId: string;
  mode: JswpMode;
  chunkRatio: ChunkRatio;
  feedbackByStep: ReadonlyMap<string, FeedbackItemRow>;
  assignment: {
    prompt: string;
    is_essay: boolean;
    has_counterargument: boolean;
    source_text: string | null;
    source_title: string | null;
    source_author: string | null;
  };
}
```

Destructure it in the function signature (`export async function CombinedView({ writingId, mode, chunkRatio, feedbackByStep, assignment }: Props)`), and render the note at the end of each section. Replace the `<section>` body:

```tsx
        {visible.map((step) => (
          <section
            key={step.key}
            className="border-l-2 border-gray-100 pl-4"
            aria-labelledby={`step-${step.key}`}
          >
            {renderStep({
              step,
              writingId,
              mode,
              chunkRatio,
              assignment,
              decoding,
            })}
            <SectionFeedbackNote
              writingId={writingId}
              stepKey={step.key}
              initialBody={feedbackByStep.get(step.key)?.body ?? ""}
            />
          </section>
        ))}
```

- [ ] **Step 2: Group feedback in the page; pass the map; move the overall panel to the end**

In `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx`:

Add the import:

```ts
import { groupSectionFeedback } from "@/lib/section-feedback";
```

After `const unresolvedCount = ...`, group the feedback:

```ts
  const { byStep: feedbackByStep, overall: overallFeedback } =
    groupSectionFeedback(feedback);
```

Change `unresolvedCount` to count only overall (the panel now shows only overall rows):

```ts
  const unresolvedCount = overallFeedback.filter((f) => !f.is_resolved).length;
```

Replace the two-column grid (the `<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]"> … </div>`) with a single column: `CombinedView` (now carrying inline section notes) followed by the overall panel under a heading:

```tsx
      <div className="space-y-8">
        <CombinedView
          writingId={writing.id}
          mode={writing.assignment.mode}
          chunkRatio={writing.chunk_ratio}
          feedbackByStep={feedbackByStep}
          assignment={{
            prompt: writing.assignment.prompt,
            is_essay: writing.assignment.is_essay,
            has_counterargument: writing.assignment.has_counterargument,
            source_text: writing.assignment.source_text,
            source_title: writing.assignment.source_title,
            source_author: writing.assignment.source_author,
          }}
        />

        <section className="border-t border-gray-200 pt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Overall feedback
          </h2>
          <FeedbackPanel
            writingId={writing.id}
            feedback={overallFeedback}
            mode="teacher"
            currentUserId={profile.id}
          />
        </section>
      </div>
```

- [ ] **Step 3: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Manual check (teacher side)**

With the dev server running, open a submitted writing at `/dashboard/assignments/<id>/writings/<writingId>`. Expected: a "Feedback on this section" box under every step; typing + clicking away shows "Saved"; the overall threaded panel sits at the bottom under "Overall feedback". Re-typing in a section box and blurring updates the same note (no duplicate). Clearing a box and blurring removes the note.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/writing-review/combined-view.tsx "app/dashboard/assignments/[id]/writings/[writingId]/page.tsx"
git commit -m "feat(feedback): per-section notes in teacher review; overall panel to end"
```

---

## Task 7: Student-side read-only section notes

**Files:**
- Modify: `app/student/writings/[id]/[step]/page.tsx` (render the matching section note read-only after return/grading)

- [ ] **Step 1: Fetch + render the section note for the current step**

In `app/student/writings/[id]/[step]/page.tsx`:

Add imports near the top:

```ts
import { listFeedback } from "@/lib/queries/teacher-feedback";
import { groupSectionFeedback } from "@/lib/section-feedback";
import { SectionFeedbackNote } from "@/components/dashboard/writing-review/section-feedback-note";
```

After `target` is resolved and the reachability gate passes (just before the `if (target.groupOrigin === ...)` dispatch chain), compute the section note for this step when the writing is returned/graded:

```ts
  // Surface the teacher's section note for this step once the writing is
  // returned or graded (read-only). RLS lets the owning student read
  // feedback on their own writing.
  let sectionNote = "";
  if (writing.status === "returned" || writing.status === "graded") {
    const { byStep } = groupSectionFeedback(await listFeedback(id));
    sectionNote = byStep.get(target.key)?.body ?? "";
  }
```

Wrap the dispatched step component so the read-only note renders above it. Change the final `return` of the dispatcher so every branch is wrapped — the simplest change is to capture the rendered step element in a variable and return it inside a fragment with the note. Concretely, rename the existing big `if/return` chain into a local `const stepEl = renderStepBody();` by extracting it into a helper, OR (minimal change) insert the note at the top of the returned JSX of the page by wrapping the dispatch.

Minimal approach: introduce a small wrapper at the single return site. Replace the body of `StepDispatcher` that currently `return`s each branch directly with a pattern that assigns to `stepEl`. If that is too invasive, instead add this just before the dispatch chain and change each `return <XStep .../>` is not required — use the following wrapper function at the end:

```tsx
  const note =
    sectionNote.trim().length > 0 ? (
      <SectionFeedbackNote
        writingId={id}
        stepKey={target.key}
        initialBody={sectionNote}
        readOnly
      />
    ) : null;

  function withNote(el: React.ReactNode) {
    return (
      <>
        {note}
        {el}
      </>
    );
  }
```

Then wrap each dispatch return with `withNote(...)`, e.g.:

```tsx
  if (target.groupOrigin === "annotate_text") {
    return withNote(
      <AnnotateTextStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        required={target.required}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }
```

Apply `withNote(...)` to **every** `return <…Step …/>` branch (including the `decode_prompt` branch and the final `PlaceholderStep` fallback) so the note shows above whichever step renders. `withNote` must be declared before the first `return` that uses it.

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Manual check (student side)**

As the teacher, leave a section note on (say) the T-Chart and Return the writing. As the student, open the writing and navigate to the T-Chart step. Expected: a read-only "Teacher feedback" block appears above the step; steps with no note show nothing; in-progress (not returned) writings show no section notes.

- [ ] **Step 4: Commit**

```bash
git add "app/student/writings/[id]/[step]/page.tsx"
git commit -m "feat(feedback): show section notes read-only on student step pages"
```

---

## Task 8: Final verification

- [ ] **Step 1: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 2: Unit tests**

Run: `npm run test:run -- section-feedback`
Expected: PASS (3 tests).

- [ ] **Step 3: RLS regression (no new policy was added)**

Run: `npm run test:run -- rls`
Expected: existing `teacher_feedback` RLS tests still pass (the new `step_key` column rides the existing read/write policies; no policy change in this feature).

- [ ] **Step 4: Production build (only with the dev server stopped)**

> Do NOT run `next build` while a `next dev` server is using `.next` — it corrupts the dev cache. Stop the dev server first.

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Update the backlog**

In `docs/BACKLOG.md`, move/annotate the "Inline-anchored teacher feedback" item: the **step-granularity** slice is now done; what remains deferred is finer-than-step anchoring (per-CD/chunk/commentary) and per-section resolve. Commit:

```bash
git add docs/BACKLOG.md
git commit -m "docs: backlog — step-granularity feedback shipped; finer anchoring still deferred"
```

---

## Self-Review (completed)

- **Spec coverage:** §3 anchoring → Task 1 (`step_key`) + Task 4 (action sets it). §4 data model → Task 1 (with the documented full-index refinement). §5 actions → Task 4. §6 queries → Task 2 (`groupSectionFeedback`) + Task 3 (`step_key` in select). §7 teacher UI → Tasks 5–6. §8 student UI → Task 7. §9 RLS → Task 8 step 3 (no change; regression check). §10 testing → Task 2 (unit), Task 6/7 manual, Task 8 (RLS regression). §11 build order → Tasks 1–7. §12 risks → addressed (layout change verified in Task 6 step 4; student surfacing is Task 7, splittable).
- **Placeholders:** none — every code step shows full code; the Task 7 wrapper approach is spelled out.
- **Type consistency:** `FeedbackItemRow.step_key: string | null` (Task 3) matches `groupSectionFeedback` (Task 2) and the `feedbackByStep: ReadonlyMap<string, FeedbackItemRow>` prop (Task 6). `upsertSectionFeedback(writingId, stepKey, body)` signature matches its call in `SectionFeedbackNote` (Task 5). `groupSectionFeedback` returns `{ byStep, overall }` used consistently in Tasks 6 and 7.
