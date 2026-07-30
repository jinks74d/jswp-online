# Feedback-Area Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight per-writing grade format (number / letter / check-or-X) with a grade on each section and one overall grade, in the teacher Feedback area, shown read-only to the student — independent of the existing rubric/total_score flow.

**Architecture:** A per-writing `grade_format` enum on `student_writings` drives one `GradeInput` control everywhere. Section grades ride on the existing per-section `teacher_feedback` row (`grade_value`); the overall grade lives on `student_writings.overall_grade`. A pure `lib/grade-format.ts` validates/renders values. No change to rubric/`total_score`/"Mark graded".

**Tech Stack:** Next.js 15 App Router (RSC + server actions), Supabase (RLS-first), TypeScript strict, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-09-feedback-grading-design.md`

---

## File Structure

- `migrations/0031_feedback_grading.sql` — **create.** Enum + 3 columns.
- `lib/database.types.ts` — **modify.** Enum + `StudentWritings` + `TeacherFeedback`.
- `lib/grade-format.ts` — **create.** Pure validate/render + `LETTER_GRADES`.
- `__tests__/lib/grade-format.test.ts` — **create.**
- `lib/queries/teacher-feedback.ts` — **modify.** `grade_value` on `FeedbackItemRow` + select.
- `lib/queries/teacher-writings.ts` — **modify.** `grade_format`/`overall_grade` in select + type.
- `lib/actions/feedback-grades.ts` — **create.** `setGradeFormat`, `setOverallGrade`, `setSectionGrade`.
- `lib/actions/teacher-feedback.ts` — **modify.** `upsertSectionFeedback` delete-guard considers `grade_value`.
- `components/dashboard/writing-review/grade-input.tsx` — **create.** The format-aware control + read-only badge.
- `components/dashboard/writing-review/grade-format-bar.tsx` — **create.** The per-writing format selector.
- `components/dashboard/writing-review/section-feedback-note.tsx` — **modify.** Section grade control/badge.
- `components/dashboard/writing-review/combined-view.tsx` — **modify.** Thread `gradeFormat` + section grade.
- `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx` — **modify.** Format bar + overall grade.
- `app/student/writings/[id]/[step]/page.tsx` — **modify.** Section grade badge (student).
- `app/student/writings/[id]/layout.tsx` + `components/student/writing/writing-shell.tsx` — **modify.** Overall grade badge (student).

---

## Task 1: Migration 0031 + types

**Files:**
- Create: `migrations/0031_feedback_grading.sql`
- Modify: `lib/database.types.ts`

- [ ] **Step 1: Write the migration**

Create `migrations/0031_feedback_grading.sql`:

```sql
-- 0031_feedback_grading.sql
-- Lightweight feedback-area grading: a per-writing grade format, a grade on
-- each section (on the per-section teacher_feedback row), and one overall
-- grade (writing-level). Independent of rubric / total_score / "Mark graded".
CREATE TYPE jswp_grade_format AS ENUM ('none', 'number', 'letter', 'check');

ALTER TABLE student_writings
  ADD COLUMN IF NOT EXISTS grade_format jswp_grade_format NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overall_grade TEXT NULL;

ALTER TABLE teacher_feedback
  ADD COLUMN IF NOT EXISTS grade_value TEXT NULL;

COMMENT ON COLUMN student_writings.grade_format IS
  'Feedback-area grade format chosen by the teacher (none=off). Drives the GradeInput control for section + overall grades. Independent of total_score. Migration 0031.';
COMMENT ON COLUMN student_writings.overall_grade IS
  'The single overall feedback grade (TEXT; interpreted per grade_format). Migration 0031.';
COMMENT ON COLUMN teacher_feedback.grade_value IS
  'Per-section grade (TEXT; interpreted per the writing''s grade_format). Meaningful only on section rows (step_key set). Migration 0031.';
```

- [ ] **Step 2: Apply to the live v2 DB**

Apply via the Supabase MCP `apply_migration` tool (project_id `hcdvypzfzrzevkwkssiw`, name `feedback_grading`) with the SQL above. Expected: `{"success":true}`. (If MCP is unavailable, run it in the Supabase SQL editor.)

- [ ] **Step 3: Add the enum + columns to the types**

In `lib/database.types.ts`:

(a) Add `jswp_grade_format` to the `Enums` map. Find the `Enums: {` block under `public` and add:
```ts
      jswp_grade_format: "none" | "number" | "letter" | "check";
```

(b) Add to `StudentWritings`:
```ts
export type StudentWritings = {
  id: string;
  assignment_id: string;
  student_id: string;
  draft_number: number;
  status: Database["public"]["Enums"]["jswp_writing_status"];
  current_step: string | null;
  chunk_ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
  submitted_at: string | null;
  returned_at: string | null;
  graded_at: string | null;
  total_score: number | null;
  // Feedback-area grading (migration 0031) — independent of total_score.
  grade_format: Database["public"]["Enums"]["jswp_grade_format"];
  overall_grade: string | null;
} & Timestamps;
```

(c) Add `grade_value` to `TeacherFeedback` (after `step_key`):
```ts
  // Per-section feedback grade (migration 0031); interpreted per grade_format.
  grade_value: string | null;
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/0031_feedback_grading.sql lib/database.types.ts
git commit -m "feat(grading): add grade_format/overall_grade/grade_value (migration 0031)"
```

---

## Task 2: `lib/grade-format.ts` (TDD)

**Files:**
- Create: `lib/grade-format.ts`
- Test: `__tests__/lib/grade-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/grade-format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidGrade, formatGradeLabel, LETTER_GRADES } from "@/lib/grade-format";

describe("isValidGrade", () => {
  it("number: 0–100 and empty valid; out-of-range/NaN invalid", () => {
    expect(isValidGrade("number", "92")).toBe(true);
    expect(isValidGrade("number", "")).toBe(true);
    expect(isValidGrade("number", "101")).toBe(false);
    expect(isValidGrade("number", "-1")).toBe(false);
    expect(isValidGrade("number", "abc")).toBe(false);
  });
  it("letter: only listed letters or empty", () => {
    expect(isValidGrade("letter", "B+")).toBe(true);
    expect(isValidGrade("letter", "")).toBe(true);
    expect(isValidGrade("letter", "E")).toBe(false);
    expect(isValidGrade("letter", "b+")).toBe(false);
  });
  it("check: check|x|empty", () => {
    expect(isValidGrade("check", "check")).toBe(true);
    expect(isValidGrade("check", "x")).toBe(true);
    expect(isValidGrade("check", "")).toBe(true);
    expect(isValidGrade("check", "maybe")).toBe(false);
  });
  it("none: only empty", () => {
    expect(isValidGrade("none", "")).toBe(true);
    expect(isValidGrade("none", "A")).toBe(false);
  });
});

describe("formatGradeLabel", () => {
  it("renders check tokens as symbols, number/letter as-is, empty/none as ''", () => {
    expect(formatGradeLabel("check", "check")).toBe("✓");
    expect(formatGradeLabel("check", "x")).toBe("✗");
    expect(formatGradeLabel("number", "92")).toBe("92");
    expect(formatGradeLabel("letter", "A-")).toBe("A-");
    expect(formatGradeLabel("letter", "")).toBe("");
    expect(formatGradeLabel("none", "A")).toBe("");
  });
});

it("LETTER_GRADES has the 13 standard entries", () => {
  expect(LETTER_GRADES.length).toBe(13);
  expect(LETTER_GRADES[0]).toBe("A+");
  expect(LETTER_GRADES[LETTER_GRADES.length - 1]).toBe("F");
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test:run -- grade-format`
Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Implement**

Create `lib/grade-format.ts`:

```ts
/**
 * Feedback-area grade formats (number / letter / check). Pure; unit-tested.
 * Grades are stored as TEXT and interpreted per the writing's grade_format.
 */

export const LETTER_GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
] as const;

export type GradeFormat = "none" | "number" | "letter" | "check";

/** Validate a stored value against the active format. Empty string = cleared. */
export function isValidGrade(format: GradeFormat, value: string): boolean {
  const v = value.trim();
  switch (format) {
    case "none":
      return v.length === 0;
    case "number": {
      if (v.length === 0) return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    }
    case "letter":
      return v.length === 0 || (LETTER_GRADES as readonly string[]).includes(v);
    case "check":
      return v.length === 0 || v === "check" || v === "x";
  }
}

/** Render a stored value for a read-only badge ('' when nothing to show). */
export function formatGradeLabel(format: GradeFormat, value: string): string {
  const v = value.trim();
  if (v.length === 0 || format === "none") return "";
  if (format === "check") return v === "check" ? "✓" : v === "x" ? "✗" : "";
  return v;
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test:run -- grade-format`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/grade-format.ts __tests__/lib/grade-format.test.ts
git commit -m "feat(grading): grade-format validate/render helper + tests"
```

---

## Task 3: Queries — surface grade fields

**Files:**
- Modify: `lib/queries/teacher-feedback.ts`
- Modify: `lib/queries/teacher-writings.ts`

- [ ] **Step 1: `grade_value` on `FeedbackItemRow`**

In `lib/queries/teacher-feedback.ts`, add to the `FeedbackItemRow` interface (after `step_key`):
```ts
  grade_value: string | null;
```
And add `grade_value` to the `listFeedback` select columns:
```ts
      id, student_writing_id, teacher_id, target_kind, target_id, step_key,
      grade_value, body, rubric_score, is_resolved, created_at, updated_at,
      author:teacher_id ( id, first_name, last_name )
```

- [ ] **Step 2: `grade_format`/`overall_grade` in the teacher review query**

In `lib/queries/teacher-writings.ts`, add `grade_format, overall_grade` to the `getWritingForTeacherReview` select (the top-level `student_writings` columns line):
```ts
      id, assignment_id, status, draft_number, submitted_at, returned_at,
      graded_at, total_score, grade_format, overall_grade, current_step, chunk_ratio,
```
Then add the two fields to the `WritingForTeacherReview` type (find its definition near the top of the file and add):
```ts
  grade_format: Database["public"]["Enums"]["jswp_grade_format"];
  overall_grade: string | null;
```
If `Database` isn't imported there, it already is (the type uses `Database[...]` elsewhere); otherwise add `import type { Database } from "@/lib/database.types";`.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors. (`getWriting` for the student uses `select("*")`, so `grade_format`/`overall_grade` flow through `StudentWritings` automatically — no change needed there.)

- [ ] **Step 4: Commit**

```bash
git add lib/queries/teacher-feedback.ts lib/queries/teacher-writings.ts
git commit -m "feat(grading): surface grade_value/grade_format/overall_grade from queries"
```

---

## Task 4: Actions — grade mutations + delete-guard

**Files:**
- Create: `lib/actions/feedback-grades.ts`
- Modify: `lib/actions/teacher-feedback.ts` (`upsertSectionFeedback` delete-guard)

- [ ] **Step 1: Create the grade actions**

Create `lib/actions/feedback-grades.ts`:

```ts
"use server";

/**
 * Feedback-area grade mutations (migration 0031). Independent of the formal
 * rubric/total_score grading. RLS scopes writes (teacher can update writings
 * they grade and write teacher_feedback on them).
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { isValidGrade, type GradeFormat } from "@/lib/grade-format";

const TEACHER_ROLES: ("teacher" | "school_admin" | "district_admin" | "super_admin")[] = [
  "teacher",
  "school_admin",
  "district_admin",
  "super_admin",
];

async function revalidateFor(
  writingId: string,
  assignmentId: string | null
): Promise<void> {
  if (assignmentId) {
    revalidatePath(
      `/dashboard/assignments/${assignmentId}/writings/${writingId}`
    );
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function setGradeFormat(
  writingId: string,
  format: GradeFormat
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id")
    .eq("id", writingId)
    .maybeSingle();
  const { error } = await supabase
    .from("student_writings")
    .update({ grade_format: format })
    .eq("id", writingId);
  if (error) throw new Error(`setGradeFormat: ${error.message}`);
  await revalidateFor(writingId, writing?.assignment_id ?? null);
}

export async function setOverallGrade(
  writingId: string,
  value: string
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id, grade_format")
    .eq("id", writingId)
    .maybeSingle();
  if (!writing) throw new Error("setOverallGrade: writing not found");
  const trimmed = value.trim();
  if (trimmed && !isValidGrade(writing.grade_format, trimmed)) {
    throw new Error("Invalid grade for this format.");
  }
  const { error } = await supabase
    .from("student_writings")
    .update({ overall_grade: trimmed.length > 0 ? trimmed : null })
    .eq("id", writingId);
  if (error) throw new Error(`setOverallGrade: ${error.message}`);
  await revalidateFor(writingId, writing.assignment_id);
}

export async function setSectionGrade(
  writingId: string,
  stepKey: string,
  value: string
): Promise<void> {
  const profile = await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select("assignment_id, grade_format")
    .eq("id", writingId)
    .maybeSingle();
  if (!writing) throw new Error("setSectionGrade: writing not found");
  const trimmed = value.trim();
  if (trimmed && !isValidGrade(writing.grade_format, trimmed)) {
    throw new Error("Invalid grade for this format.");
  }

  // Existing section row for (writing, teacher, step)?
  const { data: existing } = await supabase
    .from("teacher_feedback")
    .select("id, body")
    .eq("student_writing_id", writingId)
    .eq("teacher_id", profile.id)
    .eq("step_key", stepKey)
    .maybeSingle();

  if (trimmed.length === 0) {
    // Clearing the grade: delete the row only if it has no note either.
    if (existing) {
      const bodyEmpty = (existing.body ?? "").trim().length === 0;
      const { error } = bodyEmpty
        ? await supabase.from("teacher_feedback").delete().eq("id", existing.id)
        : await supabase
            .from("teacher_feedback")
            .update({ grade_value: null })
            .eq("id", existing.id);
      if (error) throw new Error(`setSectionGrade clear: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("teacher_feedback").upsert(
      {
        student_writing_id: writingId,
        teacher_id: profile.id,
        target_kind: "student_writing",
        target_id: writingId,
        step_key: stepKey,
        body: existing?.body ?? "",
        grade_value: trimmed,
        is_resolved: false,
      },
      { onConflict: "student_writing_id,teacher_id,step_key" }
    );
    if (error) throw new Error(`setSectionGrade set: ${error.message}`);
  }
  await revalidateFor(writingId, writing.assignment_id);
}
```

- [ ] **Step 2: Make `upsertSectionFeedback` keep grade-only rows**

In `lib/actions/teacher-feedback.ts`, the empty-body branch of `upsertSectionFeedback` currently always deletes. Replace that branch so it preserves a row that still carries a grade. Find:

```ts
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
```

Replace with:

```ts
  if (trimmed.length === 0) {
    // Empty note: delete the row only if it has no grade either; otherwise
    // just clear the body and keep the row (the section grade lives on it).
    const { data: existing } = await supabase
      .from("teacher_feedback")
      .select("id, grade_value")
      .eq("student_writing_id", writingId)
      .eq("teacher_id", profile.id)
      .eq("step_key", stepKey)
      .maybeSingle();
    if (existing) {
      const hasGrade = (existing.grade_value ?? "").trim().length > 0;
      const { error } = hasGrade
        ? await supabase
            .from("teacher_feedback")
            .update({ body: "" })
            .eq("id", existing.id)
        : await supabase.from("teacher_feedback").delete().eq("id", existing.id);
      if (error) {
        throw new Error(`upsertSectionFeedback clear: ${error.message}`);
      }
    }
  } else {
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/feedback-grades.ts lib/actions/teacher-feedback.ts
git commit -m "feat(grading): grade mutations + grade-aware section-row lifecycle"
```

---

## Task 5: `GradeInput` component

**Files:**
- Create: `components/dashboard/writing-review/grade-input.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/writing-review/grade-input.tsx`:

```tsx
"use client";

/**
 * Format-aware grade control for the feedback area (migration 0031).
 *  - format='none'  → renders nothing.
 *  - readOnly       → a small badge (formatGradeLabel), nothing when empty.
 *  - number         → a 0–100 input, saves on blur.
 *  - letter         → a <select> of LETTER_GRADES (+ "—" to clear).
 *  - check          → ✓ / ✗ toggle buttons (click active to clear).
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  LETTER_GRADES,
  formatGradeLabel,
  type GradeFormat,
} from "@/lib/grade-format";

export function GradeInput({
  format,
  value,
  onSave,
  readOnly = false,
}: {
  format: GradeFormat;
  value: string;
  onSave?: (value: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(value);

  if (format === "none") return null;

  if (readOnly) {
    const text = formatGradeLabel(format, value);
    if (!text) return null;
    return (
      <span className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-0.5 text-sm font-semibold text-stone-800">
        {text}
      </span>
    );
  }

  const save = (next: string) => {
    if (!onSave) return;
    start(async () => {
      try {
        await onSave(next);
      } catch (e) {
        console.error("grade save:", e);
      }
    });
  };

  if (format === "check") {
    return (
      <span className="inline-flex items-center gap-1">
        {(["check", "x"] as const).map((tok) => {
          const active = value === tok;
          return (
            <button
              key={tok}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => save(active ? "" : tok)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold ${
                active
                  ? "border-stone-400 bg-stone-100 text-stone-900"
                  : "border-stone-200 text-stone-400 hover:bg-stone-50"
              }`}
            >
              {tok === "check" ? "✓" : "✗"}
            </button>
          );
        })}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
      </span>
    );
  }

  if (format === "letter") {
    return (
      <select
        value={value}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        className="rounded-md border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Grade"
      >
        <option value="">—</option>
        {LETTER_GRADES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }

  // number
  return (
    <input
      type="number"
      min={0}
      max={100}
      inputMode="numeric"
      value={local}
      disabled={pending}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local.trim() !== value.trim()) save(local.trim());
      }}
      placeholder="0–100"
      aria-label="Grade"
      className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/writing-review/grade-input.tsx
git commit -m "feat(grading): GradeInput control (number/letter/check + badge)"
```

---

## Task 6: `GradeFormatBar` component

**Files:**
- Create: `components/dashboard/writing-review/grade-format-bar.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/writing-review/grade-format-bar.tsx`:

```tsx
"use client";

/**
 * Per-writing grade-format selector (migration 0031). Sets
 * student_writings.grade_format; all section + overall grade inputs follow.
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setGradeFormat } from "@/lib/actions/feedback-grades";
import type { GradeFormat } from "@/lib/grade-format";

const OPTIONS: { value: GradeFormat; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "number", label: "Number" },
  { value: "letter", label: "Letter" },
  { value: "check", label: "✓ / ✗" },
];

export function GradeFormatBar({
  writingId,
  format,
}: {
  writingId: string;
  format: GradeFormat;
}) {
  const [pending, start] = useTransition();

  const choose = (f: GradeFormat) => {
    if (f === format) return;
    start(async () => {
      try {
        await setGradeFormat(writingId, f);
      } catch (e) {
        console.error("set grade format:", e);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <span className="text-sm font-medium text-stone-700">Grade format</span>
      <div className="inline-flex overflow-hidden rounded-md border border-stone-200">
        {OPTIONS.map((o) => {
          const active = o.value === format;
          return (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              onClick={() => choose(o.value)}
              className={`px-3 py-1 text-sm font-medium ${
                active
                  ? "bg-slate-800 text-white"
                  : "bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      <span className="text-xs text-stone-500">
        Applies to every section grade and the overall grade.
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/writing-review/grade-format-bar.tsx
git commit -m "feat(grading): GradeFormatBar per-writing format selector"
```

---

## Task 7: Teacher wiring — section grade + format bar + overall grade

**Files:**
- Modify: `components/dashboard/writing-review/section-feedback-note.tsx`
- Modify: `components/dashboard/writing-review/combined-view.tsx`
- Modify: `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx`

- [ ] **Step 1: Section grade in `SectionFeedbackNote`**

In `components/dashboard/writing-review/section-feedback-note.tsx`:

Add imports:
```ts
import { GradeInput } from "./grade-input";
import { setSectionGrade } from "@/lib/actions/feedback-grades";
import type { GradeFormat } from "@/lib/grade-format";
```

Extend the exported `SectionFeedbackNote` props with `gradeFormat` and `gradeValue`:
```ts
export function SectionFeedbackNote({
  writingId,
  stepKey,
  initialBody,
  readOnly = false,
  gradeFormat,
  gradeValue,
}: {
  writingId: string;
  stepKey: string;
  initialBody: string;
  readOnly?: boolean;
  gradeFormat: GradeFormat;
  gradeValue: string;
}) {
```

In the `readOnly` branch, render the note text (as today) and, when present, the grade badge. Change the read-only return so the badge shows in the header row:
```tsx
  if (readOnly) {
    const text = initialBody.trim();
    const badge =
      gradeFormat !== "none" ? (
        <GradeInput format={gradeFormat} value={gradeValue} readOnly />
      ) : null;
    if (text.length === 0 && !badge) return null;
    return (
      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
            <MessageSquare className="h-3.5 w-3.5" />
            Teacher feedback
          </span>
          {badge}
        </div>
        {text.length > 0 && (
          <p className="whitespace-pre-wrap text-sm text-gray-900">{text}</p>
        )}
      </div>
    );
  }
```

In the teacher (editable) branch — the `TeacherNote` render — add the section `GradeInput` next to the header status. Pass `gradeFormat`/`gradeValue` down to `TeacherNote`:
```tsx
  return (
    <TeacherNote
      writingId={writingId}
      stepKey={stepKey}
      initialBody={initialBody}
      gradeFormat={gradeFormat}
      gradeValue={gradeValue}
    />
  );
```
Extend `TeacherNote`'s props with `gradeFormat: GradeFormat` and `gradeValue: string`, and in its header row (the `<div className="mb-1.5 flex items-center justify-between">`) replace the right-hand status span group so the grade input sits beside the save status:
```tsx
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
          <MessageSquare className="h-3.5 w-3.5" />
          Feedback on this section
        </span>
        <div className="flex items-center gap-2">
          {gradeFormat !== "none" && (
            <GradeInput
              format={gradeFormat}
              value={gradeValue}
              onSave={(v) => setSectionGrade(writingId, stepKey, v)}
            />
          )}
          <span className="text-xs text-gray-500" aria-live="polite">
            {status === "saving" && "Saving…"}
            {status === "saved" && <span className="text-green-600">Saved</span>}
            {status === "error" && <span className="text-red-600">Retry?</span>}
          </span>
        </div>
      </div>
```

- [ ] **Step 2: Thread grade data through `CombinedView`**

In `components/dashboard/writing-review/combined-view.tsx`:

Add to imports:
```ts
import type { GradeFormat } from "@/lib/grade-format";
```
Add `gradeFormat` to `Props`:
```ts
  gradeFormat: GradeFormat;
```
Destructure it in the `CombinedView` signature. Then update the `SectionFeedbackNote` render inside the `visible.map` to pass the grade props (the section's `grade_value` comes from the same `feedbackByStep` row):
```tsx
            <SectionFeedbackNote
              writingId={writingId}
              stepKey={step.key}
              initialBody={feedbackByStep.get(step.key)?.body ?? ""}
              gradeFormat={gradeFormat}
              gradeValue={feedbackByStep.get(step.key)?.grade_value ?? ""}
            />
```

- [ ] **Step 3: Format bar + overall grade on the review page**

In `app/dashboard/assignments/[id]/writings/[writingId]/page.tsx`:

Add imports:
```ts
import { GradeFormatBar } from "@/components/dashboard/writing-review/grade-format-bar";
import { GradeInput } from "@/components/dashboard/writing-review/grade-input";
import { setOverallGrade } from "@/lib/actions/feedback-grades";
```

Render the `GradeFormatBar` at the top of the review content (just inside the `<div className="space-y-8">`, before `<CombinedView>`):
```tsx
      <div className="space-y-8">
        <GradeFormatBar writingId={writing.id} format={writing.grade_format} />

        <CombinedView
          writingId={writing.id}
          mode={writing.assignment.mode}
          chunkRatio={writing.chunk_ratio}
          feedbackByStep={feedbackByStep}
          gradeFormat={writing.grade_format}
          assignment={{
```
(keep the rest of the `CombinedView` props unchanged).

In the "Overall feedback" `<section>`, add the overall `GradeInput` under the heading, above the `FeedbackPanel`:
```tsx
        <section className="border-t border-gray-200 pt-6">
          <h2 id="overall-feedback-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Overall feedback
          </h2>
          {writing.grade_format !== "none" && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-stone-700">
                Overall grade
              </span>
              <GradeInput
                format={writing.grade_format}
                value={writing.overall_grade ?? ""}
                onSave={(v) => setOverallGrade(writing.id, v)}
              />
            </div>
          )}
          <FeedbackPanel
            writingId={writing.id}
            feedback={overallFeedback}
            mode="teacher"
            currentUserId={profile.id}
          />
        </section>
```
(`onSave` is an inline client closure calling a server action — `setOverallGrade` is a server action, callable from a client boundary. `GradeInput` and `GradeFormatBar` are client components; this page is a server component that renders them, which is allowed. The `onSave` arrow is created in server render but passed to a client component — that is NOT allowed for non-serializable props. Instead, wrap the overall control in a tiny client component.)

Create `components/dashboard/writing-review/overall-grade-control.tsx`:
```tsx
"use client";

import { GradeInput } from "./grade-input";
import { setOverallGrade } from "@/lib/actions/feedback-grades";
import type { GradeFormat } from "@/lib/grade-format";

export function OverallGradeControl({
  writingId,
  format,
  value,
}: {
  writingId: string;
  format: GradeFormat;
  value: string;
}) {
  if (format === "none") return null;
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-sm font-medium text-stone-700">Overall grade</span>
      <GradeInput
        format={format}
        value={value}
        onSave={(v) => setOverallGrade(writingId, v)}
      />
    </div>
  );
}
```
Then in the page use it instead of the inline block (and drop the `GradeInput`/`setOverallGrade` page imports, keeping only the `OverallGradeControl` import):
```tsx
import { OverallGradeControl } from "@/components/dashboard/writing-review/overall-grade-control";
```
```tsx
          <OverallGradeControl
            writingId={writing.id}
            format={writing.grade_format}
            value={writing.overall_grade ?? ""}
          />
```

> Same applies to the section onSave — but that closure lives **inside** `SectionFeedbackNote` (a client component), so it is fine there.

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 5: Manual check (teacher)**

Open a submitted writing. Set Grade format = Letter → a letter `<select>` appears beside each section note and an "Overall grade" select appears in the Overall area. Pick grades; reload — they persist. Switch format to ✓/✗ → controls switch. Set format Off → all grade controls disappear.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/writing-review/section-feedback-note.tsx components/dashboard/writing-review/combined-view.tsx components/dashboard/writing-review/overall-grade-control.tsx "app/dashboard/assignments/[id]/writings/[writingId]/page.tsx"
git commit -m "feat(grading): teacher section + overall grade controls + format bar"
```

---

## Task 8: Student wiring — read-only grade badges

**Files:**
- Modify: `app/student/writings/[id]/[step]/page.tsx`
- Modify: `app/student/writings/[id]/layout.tsx` + `components/student/writing/writing-shell.tsx`

- [ ] **Step 1: Section grade badge on the student step page**

In `app/student/writings/[id]/[step]/page.tsx`, the read-only `SectionFeedbackNote` is rendered when returned/graded. Extend the block that computes `sectionNote` to also pull the grade, and pass `gradeFormat`/`gradeValue`. Replace the existing section-note block:
```ts
  let sectionNote = "";
  let sectionGrade = "";
  if (writing.status === "returned" || writing.status === "graded") {
    const { byStep } = groupSectionFeedback(await listFeedback(id));
    const row = byStep.get(target.key);
    sectionNote = row?.body ?? "";
    sectionGrade = row?.grade_value ?? "";
  }
  const noteEl =
    sectionNote.trim().length > 0 || sectionGrade.trim().length > 0 ? (
      <SectionFeedbackNote
        writingId={id}
        stepKey={target.key}
        initialBody={sectionNote}
        gradeFormat={writing.grade_format}
        gradeValue={sectionGrade}
        readOnly
      />
    ) : null;
```
(`writing.grade_format` is available because `getWriting` selects `*`.)

- [ ] **Step 2: Overall grade badge for the student**

In `components/student/writing/writing-shell.tsx`, add `overallGrade` + `gradeFormat` props and render a badge in the feedback area. Add to the `WritingShell` props:
```ts
  gradeFormat: import("@/lib/grade-format").GradeFormat;
  overallGrade: string | null;
```
Inside the feedback column (where `FeedbackPanel` renders), prepend the overall grade badge. Just above the `<FeedbackPanel ... mode="student" ... />`, add:
```tsx
            {gradeFormat !== "none" &&
              (overallGrade ?? "").trim().length > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-stone-200 bg-white p-3 shadow-sm">
                  <span className="text-sm font-medium text-stone-700">
                    Overall grade
                  </span>
                  <span className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-0.5 text-sm font-semibold text-stone-800">
                    {require("@/lib/grade-format").formatGradeLabel(
                      gradeFormat,
                      overallGrade ?? ""
                    )}
                  </span>
                </div>
              )}
```
> Do NOT use `require()` in the component (it's a client component). Instead add a top import `import { formatGradeLabel } from "@/lib/grade-format";` and use `formatGradeLabel(gradeFormat, overallGrade ?? "")` in the JSX above.

Then in `app/student/writings/[id]/layout.tsx`, pass the two new props to `WritingShell`. The layout already loads the writing; pass:
```tsx
        gradeFormat={writing.grade_format}
        overallGrade={writing.overall_grade}
```
If the layout's writing query doesn't already include these, confirm it selects `*` or add `grade_format, overall_grade` to its select. (Check `app/student/writings/[id]/layout.tsx` — adjust its query/types as needed so `writing.grade_format` / `writing.overall_grade` are present.)

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors. Fix any missing-field types by ensuring the student layout's writing query returns `grade_format`/`overall_grade`.

- [ ] **Step 4: Manual check (student)**

As teacher, set format Letter, give the T-Chart a `B+` and an overall `A-`, Return the writing. As the student, open the writing → the T-Chart step shows a `B+` badge by its feedback; the overall feedback area shows `A-`. With format Off, no badges show.

- [ ] **Step 5: Commit**

```bash
git add "app/student/writings/[id]/[step]/page.tsx" "app/student/writings/[id]/layout.tsx" components/student/writing/writing-shell.tsx
git commit -m "feat(grading): read-only section + overall grade badges for the student"
```

---

## Task 9: Final verification

- [ ] **Step 1: Type-check** — `npm run type-check` → no errors.
- [ ] **Step 2: Unit tests** — `npm run test:run -- grade-format` → PASS; `npm run test:run -- __tests__/lib` → all PASS.
- [ ] **Step 3: RLS regression** — `npm run test:run -- rls` → existing `teacher_feedback` + `student_writings` tests still pass (no policy change; `setGradeFormat`/`setOverallGrade` use the same `student_writings` UPDATE path the "Mark graded" flow already uses).
- [ ] **Step 4: Production build** — only with the dev server stopped (`next build` corrupts a live `next dev` cache): `npm run build` → succeeds.
- [ ] **Step 5: Backlog note** — in `docs/BACKLOG.md`, note the feedback-grading feature shipped and that reconciling it with `total_score` (if ever wanted) + per-section weighting are deferred. Commit.

---

## Self-Review (completed)

- **Spec coverage:** §3 data model → Task 1. §4 grade-format helper → Task 2. §5.1 GradeInput → Task 5. §5.2 format bar → Task 6 + Task 7.3. §5.3 section grade → Task 7.1–7.2. §5.4 overall grade → Task 7.3. §5.5 student badges → Task 8. §6 actions → Task 4. §7 queries → Task 3. §8 RLS → Task 9.3 (regression; same UPDATE path). §9 independence → no task touches total_score/rubric. §10 testing → Task 2 (unit), Task 7.5/8.4 (manual), Task 9 (regression). §11 build order → Tasks 1–8.
- **Placeholders:** none — full code for every novel unit; the one server/client-boundary gotcha (overall `onSave`) is resolved with `OverallGradeControl`, and the `require()` note in Task 8 is corrected to a top import.
- **Type consistency:** `GradeFormat` from `lib/grade-format.ts` is used uniformly (GradeInput, GradeFormatBar, SectionFeedbackNote, CombinedView, actions). `FeedbackItemRow.grade_value: string \| null` (Task 3) matches the `?? ""` reads in Tasks 7–8. `setSectionGrade(writingId, stepKey, value)` / `setOverallGrade(writingId, value)` / `setGradeFormat(writingId, format)` signatures match their call sites. `student_writings.grade_format`/`overall_grade` (Task 1) match the query additions (Task 3) and the page/shell reads (Tasks 7–8).
