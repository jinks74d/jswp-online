# Literary WOW Per-Paragraph Fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Literary mode's per-paragraph WOW (Web-off-the-Word) machinery faithful to the printed guide: each chosen CM word webs to a synonym + 2+ phrases, plus a CD-Analysis helper and a final-draft self-check.

**Architecture:** Extend `commentary_items` with `synonym` + `parent_cm_id` (phrase → its CM word) via one migration (which also adds `final_drafts.self_checks`). Rework the Elaboration step to render per best word; thread the new link through the commentary query/actions and the Shaping pick-n-stitch grouping. Add two component-only enrichments (CD-Analysis question helper, final-draft LP/POV self-check) that depend only on the migration.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript strict, Supabase (`@supabase/ssr`, RLS-first, no ORM), Tailwind v4, Vitest. Spec: `docs/superpowers/specs/2026-06-22-literary-wow-fidelity-design.md`.

## Global Constraints

- Strict TypeScript, no `any`, no `@ts-ignore` without a justifying comment.
- No new dependencies (CLAUDE.md §3/§15.1).
- Files `kebab-case`; React components `PascalCase` export; DB `snake_case`.
- **Every student-facing string is lifted verbatim from `docs/reference/Sec_RL.pdf`** with the page cite in the spec — invent nothing (CLAUDE.md §15.2). The enumerated "no-no-words" list is content-blocked and NOT in scope.
- Use the three Supabase factories (`lib/supabase/{server,client,middleware}.ts`); never expose the service-role key client-side. Always check `{ data, error }`.
- Every server action calls `await requireRole("student")` and `revalidatePath(\`/student/writings/${writingId}\`, "layout")` — match existing actions in `lib/actions/commentary.ts`.
- Read-only (teacher review) mode must disable new inputs — gate via `useWritingMode().isReadOnly`, matching siblings.
- Gates before each commit: `npm run type-check` and (where tests exist) `npm run test:run`. `npm run build` before the final commit. `npm run lint` is known-broken — ignore it.
- Migrations are validated with `pglast` and applied to the live `v2` Supabase project (use the run-sql / Supabase MCP path). No `master` work.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/jswp-modes.ts` | reword literary `gather_cds` hint | 1 |
| `migrations/0032_literary_wow_fidelity.sql` | add `commentary_items.synonym`, `.parent_cm_id` (+ index); `final_drafts.self_checks` | 2 |
| `lib/queries/commentary.ts` | surface `synonym` + `parent_cm_id` on `CommentaryItemData` | 3 |
| `lib/actions/commentary.ts` | `createPhraseCm(... parentCmId)`; new `updateCmSynonym` | 4 |
| `components/student/writing/elaboration/elaboration-client.tsx` | new per-best-word Continue gate (`computeGate`) | 5 |
| `components/student/writing/elaboration/elaboration-bp-pane.tsx` | render per best word: synonym input + that word's phrases | 6 |
| `lib/queries/shaping.ts` + `components/student/writing/shaping/cd-cm-shaping-bp-pane.tsx` + `pick-n-stitch-panel.tsx` | group literary stitch phrases under their CM word | 7 |
| `lib/jswp-literary-cd-analysis.ts` | the 13 CD-Analysis questions (verbatim constant) | 8 |
| `components/student/writing/cm-dev/cm-dev-bp-pane.tsx` | render the CD-Analysis helper panel | 9 |
| `lib/jswp-literary-final-checks.ts` | self-check items + first/second-person pronoun regex | 10 |
| `lib/queries/final-draft.ts` + `lib/actions/final-draft.ts` + `components/student/writing/final-draft/final-draft-client.tsx` | persist + render the self-check + pronoun nudge | 11 |

---

## Task 1: Fix the Gather-CDs contradiction (item a)

**Files:**
- Modify: `lib/jswp-modes.ts` (literary `gather_cds` step, `pedagogyHint` ~line 383)

**Interfaces:** none consumed/produced.

- [ ] **Step 1: Edit the hint**

In `lib/jswp-modes.ts`, the literary `gather_cds` step's `pedagogyHint`, replace:

```ts
      "List 3-5 concrete details from the text. For literary, you'll combine them into ONE sentence per chunk (1:2+). Drag to reorder.",
```

with:

```ts
      "List 3-5 concrete details from the text. Pick the single strongest CD for each chunk — one CD per chunk (1:2+). Drag to reorder.",
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes (exit 0).

- [ ] **Step 3: Commit**

```bash
git add lib/jswp-modes.ts
git commit -m "fix(literary): gather_cds hint — one CD per chunk, not merge (1:2+)"
```

---

## Task 2: Migration 0032 — schema for WOW + final-draft self-check (item b + e column)

**Files:**
- Create: `migrations/0032_literary_wow_fidelity.sql`

**Interfaces:**
- Produces: columns `commentary_items.synonym TEXT`, `commentary_items.parent_cm_id UUID` (FK → `commentary_items(id)` ON DELETE CASCADE), index `idx_cms_parent_cm`; column `final_drafts.self_checks TEXT[]`.

- [ ] **Step 1: Write the migration**

Create `migrations/0032_literary_wow_fidelity.sql`:

```sql
-- 0032_literary_wow_fidelity.sql
-- Literary WOW per-paragraph fidelity (spec 2026-06-22-literary-wow-fidelity-design.md).
-- Web-off-the-Word stores, per chosen CM word: a synonym (box #2) and 2+ phrases
-- (clouds, #3). Phrases link to their word via parent_cm_id (they keep parent_cd_id
-- for chunk/CD context). final_drafts.self_checks mirrors shaping_sheets.revision_moves.

ALTER TABLE commentary_items ADD COLUMN synonym TEXT;

ALTER TABLE commentary_items
  ADD COLUMN parent_cm_id UUID REFERENCES commentary_items(id) ON DELETE CASCADE;

CREATE INDEX idx_cms_parent_cm ON commentary_items(parent_cm_id);

ALTER TABLE final_drafts ADD COLUMN self_checks TEXT[];
```

RLS unchanged — `commentary_items` / `final_drafts` policies scope via their ancestry (`0002_rls_policies.sql`), which the new columns inherit. No new policy, no `rls.test.ts` case.

- [ ] **Step 2: Validate SQL with pglast**

Run the project's pglast lint over the file (same tool that validated `0001`).
Expected: parses clean, no errors.

- [ ] **Step 3: Apply to live v2**

Apply `0032_literary_wow_fidelity.sql` to the live `v2` Supabase project (run-sql / Supabase MCP `apply_migration`). Verify the four DDL statements succeed.

- [ ] **Step 4: Regenerate or hand-extend `lib/database.types.ts`**

Add to the `commentary_items` Row/Insert/Update: `synonym: string | null` and `parent_cm_id: string | null`. Add to `final_drafts`: `self_checks: string[] | null`. (Match the hand-written style already in the file; Insert/Update make them optional/nullable.)

- [ ] **Step 5: Type-check + commit**

Run: `npm run type-check` → passes.

```bash
git add migrations/0032_literary_wow_fidelity.sql lib/database.types.ts
git commit -m "feat(literary): migration 0032 — commentary_items synonym + parent_cm_id; final_drafts.self_checks"
```

---

## Task 3: Surface `synonym` + `parent_cm_id` in the commentary query (item b)

**Files:**
- Modify: `lib/queries/commentary.ts` (type `CommentaryItemData`; the select string; grouping is unchanged)

**Interfaces:**
- Consumes: the new columns from Task 2.
- Produces: `CommentaryItemData` gains `synonym: string | null` and `parent_cm_id: string | null`. Phrases continue to be grouped per CD by `parent_cd_id`; the component (Task 6) sub-groups phrases by `parent_cm_id`.

- [ ] **Step 1: Extend the type**

In `lib/queries/commentary.ts`, add two fields to `CommentaryItemData`:

```ts
export interface CommentaryItemData {
  id: string;
  position: number;
  text: string;
  kind: CmKind;
  parent_cd_id: string | null;
  parent_cm_id: string | null;   // phrase → the CM word it elaborates (WOW)
  synonym: string | null;        // WOW box #2, set on the best-word row
  is_best_word_for_ts: boolean;
  is_best_word_for_chunk: boolean;
}
```

- [ ] **Step 2: Extend the select string**

In the `commentary_items ( ... )` select, add `parent_cm_id, synonym`:

```ts
    commentary_items (
      id, position, text, kind, parent_cd_id, parent_cm_id, synonym,
      is_best_word_for_ts, is_best_word_for_chunk
    )
```

Ensure the row→`CommentaryItemData` mapping passes the two new fields through (the existing grouping by `parent_cd_id` and split by `kind` is unchanged).

- [ ] **Step 3: Type-check + commit**

Run: `npm run type-check` → passes.

```bash
git add lib/queries/commentary.ts
git commit -m "feat(literary): query synonym + parent_cm_id on commentary items"
```

---

## Task 4: Commentary actions — phrase parent link + synonym (item b)

**Files:**
- Modify: `lib/actions/commentary.ts`

**Interfaces:**
- Consumes: Task 2 columns.
- Produces:
  - `createPhraseCm(writingId: string, chunkId: string, parentCdId: string, parentCmId: string): Promise<void>` — now inserts `parent_cm_id`.
  - `updateCmSynonym(writingId: string, cmId: string, synonym: string): Promise<void>` — `.update({ synonym })` on the word row.

- [ ] **Step 1: Add `parentCmId` to `createPhraseCm`**

Add a `parentCmId: string` parameter and include `parent_cm_id: parentCmId` in the inserted row (keep `kind: 'phrase'`, `parent_cd_id: parentCdId`, and the existing `position = max(existing phrase positions for this CD) + 1`). Keep `requireRole("student")` + `revalidatePath`.

- [ ] **Step 2: Add `updateCmSynonym`**

```ts
export async function updateCmSynonym(
  writingId: string,
  cmId: string,
  synonym: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("commentary_items")
    .update({ synonym: synonym.trim() === "" ? null : synonym })
    .eq("id", cmId);
  if (error) throw new Error(`Failed to update synonym: ${error.message}`);
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
```
(Match the exact client-import + error style already used by `updateCmText` in this file.)

- [ ] **Step 3: Type-check + commit**

Run: `npm run type-check` → passes (NB: callers of `createPhraseCm` now fail to type-check until Task 6 — if executing strictly task-by-task, expect the elaboration component's existing call to error here; that call is rewritten in Task 6. Commit this task with the action change; the component compiles in Task 6.)

> Reviewer note: Tasks 4 and 6 form one compile unit (the `createPhraseCm` signature change). If your runner requires green type-check per commit, fold Task 6 into this commit; otherwise commit Task 4 and let Task 6 restore green.

```bash
git add lib/actions/commentary.ts
git commit -m "feat(literary): createPhraseCm parent_cm_id link + updateCmSynonym action"
```

---

## Task 5: Elaboration Continue gate — ≥2 phrases per best word (item b, TDD)

**Files:**
- Modify: `components/student/writing/elaboration/elaboration-client.tsx` (the pure `computeGate`)
- Create: `components/student/writing/elaboration/__tests__/compute-gate.test.ts` (extract `computeGate` so it's importable, or export it)

**Interfaces:**
- Consumes: `CommentaryBpData` with phrases now carrying `parent_cm_id` (Task 3).
- Produces: `computeGate(bps): { canContinue: boolean; blockerPosition: number | null }` where a BP passes only when **every best word** (a `cd.words` item with `is_best_word_for_chunk`) has **≥2 non-empty phrases** linked via `parent_cm_id`.

- [ ] **Step 1: Export `computeGate` and write the failing test**

Add `export` to `function computeGate` in `elaboration-client.tsx`. Create `components/student/writing/elaboration/__tests__/compute-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeGate } from "../elaboration-client";
import type { CommentaryBpData } from "@/lib/queries/commentary";

const word = (id: string, best: boolean) => ({
  id, position: 1, text: "yearn", kind: "word" as const,
  parent_cd_id: "cd1", parent_cm_id: null, synonym: null,
  is_best_word_for_ts: false, is_best_word_for_chunk: best,
});
const phrase = (id: string, parentCmId: string, text: string) => ({
  id, position: 1, text, kind: "phrase" as const,
  parent_cd_id: "cd1", parent_cm_id: parentCmId, synonym: null,
  is_best_word_for_ts: false, is_best_word_for_chunk: false,
});
const bp = (cds: CommentaryBpData["chunks"][number]["cds"]): CommentaryBpData => ({
  id: "bp1", position: 1, chunks: [{ id: "c1", position: 1, cds }],
});

describe("computeGate (elaboration)", () => {
  it("blocks when a best word has fewer than 2 phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a")], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: false, blockerPosition: 1 });
  });

  it("passes when every best word has 2+ non-empty phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a"), phrase("p2", "w1", "b")], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: true, blockerPosition: null });
  });

  it("ignores phrases linked to a different word and blank phrases", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", true)],
      phrases: [phrase("p1", "w1", "a"), phrase("p2", "w1", "   "), phrase("p3", "w2", "b")],
      sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: false, blockerPosition: 1 });
  });

  it("passes a BP with no best words (nothing to elaborate yet)", () => {
    const bps = [bp([{ id: "cd1", position: 1, text: "x",
      words: [word("w1", false)], phrases: [], sentences: [] }])];
    expect(computeGate(bps)).toEqual({ canContinue: true, blockerPosition: null });
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npm run test:run -- compute-gate`
Expected: FAIL (current gate counts ≥1 phrase per BP, not per-word).

- [ ] **Step 3: Rewrite `computeGate`**

Replace the body with per-best-word counting:

```ts
export function computeGate(bps: readonly CommentaryBpData[]): GateResult {
  for (const bp of bps) {
    for (const chunk of bp.chunks) {
      for (const cd of chunk.cds) {
        const bestWords = cd.words.filter((w) => w.is_best_word_for_chunk);
        for (const word of bestWords) {
          const phraseCount = cd.phrases.filter(
            (p) => p.parent_cm_id === word.id && p.text.trim().length > 0
          ).length;
          if (phraseCount < 2) {
            return { canContinue: false, blockerPosition: bp.position };
          }
        }
      }
    }
  }
  return { canContinue: true, blockerPosition: null };
}
```

Also update the gate copy strings near the Continue button to: `"Each best word has at least two elaboration phrases."` / `` `Body paragraph ${gate.blockerPosition} needs two phrases for each best word.` ``. Update the stale block comment at the top of the file (it currently says per-best-word counting is out of scope).

- [ ] **Step 4: Run the test — verify it passes**

Run: `npm run test:run -- compute-gate` → PASS. Then `npm run type-check` → passes.

- [ ] **Step 5: Commit**

```bash
git add components/student/writing/elaboration/elaboration-client.tsx components/student/writing/elaboration/__tests__/compute-gate.test.ts
git commit -m "feat(literary): elaboration gate requires 2+ phrases per best word (TDD)"
```

---

## Task 6: Elaboration pane — web per best word (item b)

**Files:**
- Modify: `components/student/writing/elaboration/elaboration-bp-pane.tsx`

**Interfaces:**
- Consumes: `createPhraseCm(writingId, chunkId, parentCdId, parentCmId)` + `updateCmSynonym` (Task 4); `CommentaryItemData.parent_cm_id` / `.synonym` (Task 3).

- [ ] **Step 1: Restructure `CdSection` to render per best word**

Replace the flat per-CD phrase list with one block **per best word**. For each `word` in `cd.words.filter(w => w.is_best_word_for_chunk)` render:
1. the word as a sky pill header;
2. a single-line `AutoSaveInput` for the **synonym** (`initialValue={word.synonym ?? ""}`, placeholder `"A synonym for this word (optional)"`, `onSave={(v) => updateCmSynonym(writingId, word.id, v)}`);
3. that word's phrases — `cd.phrases.filter(p => p.parent_cm_id === word.id)` — each an `AutoSaveInput` (multiline, save via `updateCmText`) + delete (`deleteCm`);
4. an **[+ Add phrase]** button calling `createPhraseCm(writingId, chunkId, cdId, word.id)`.

Keep the existing `NoBestWordsState` (shown when `cd.words.filter(is_best_word_for_chunk)` is empty) with its back-link to Making Decisions. Update the pane's intro copy to the verbatim WOW prompt: `"For each best word: write a synonym, then 2+ phrases answering — what does it mean to the character to be that?"` Remove the stale "Phase 7 backlog: parent_cm_id FK migration" comment in the file header.

Reuse `AutoSaveInput` from `../t-chart/auto-save-input` and `useWritingMode()` exactly as the current file does. The phrase placeholder becomes `"A 3+ word phrase — what does it mean to the character?"` (drop the "synonym or…" wording now that synonym has its own field).

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check` → passes (restores green after Task 4). Run: `npm run build` → compiles.

- [ ] **Step 3: Commit**

```bash
git add components/student/writing/elaboration/elaboration-bp-pane.tsx
git commit -m "feat(literary): elaboration webs per best word — synonym + linked phrases"
```

- [ ] **Step 4: Browser-verify (manual)**

On a literary writing, at Elaboration: each best word shows its own synonym field + phrase list; adding a phrase under word A doesn't appear under word B; Continue is blocked until each best word has 2 phrases. (Cannot be tested in jsdom — verify on the dev server / preview.)

---

## Task 7: Shaping pick-n-stitch — group phrases under their CM word (item b)

**Files:**
- Modify: `lib/queries/shaping.ts` (add `parent_cm_id`, `synonym` to `ShapingCmData` + select)
- Modify: `components/student/writing/shaping/cd-cm-shaping-bp-pane.tsx` (group literary stitch phrases by `parent_cm_id`)
- Modify: `components/student/writing/shaping/pick-n-stitch-panel.tsx` (render grouped, labelled by the best word)

**Interfaces:**
- Consumes: Task 2 columns.
- Produces: for literary, the pick-n-stitch panel shows phrases grouped under their best word (label = the word text); the per-phrase `used_in_*` toggles (`setCmFlag`) are unchanged.

- [ ] **Step 1: Extend `ShapingCmData` + select**

In `lib/queries/shaping.ts` add `parent_cm_id: string | null;` and `synonym: string | null;` to `ShapingCmData`, and add `parent_cm_id, synonym` to the `commentary_items` select string.

- [ ] **Step 2: Build grouped stitch data for literary**

In `cd-cm-shaping-bp-pane.tsx` (where `stitchKind = mode === "literary" ? "phrase" : "sentence"`), when `mode === "literary"` build groups: the best words are `bp.chunks.flatMap(c => c.cms.filter(cm => cm.kind === "word" && cm.is_best_word_for_chunk))`; each group is `{ word, phrases: allPhrases.filter(p => p.parent_cm_id === word.id) }`. Pass groups to `PickNStitchPanel` via a new optional `groups` prop; for non-literary keep the existing flat `cms` prop. (Keep the flat path untouched for argumentation/expository — they stitch `sentence` kind.)

- [ ] **Step 3: Render groups in the panel**

In `pick-n-stitch-panel.tsx`, when `groups` is provided, render each group as a labelled section (`<h4>` = `group.word.text`, with the word's `synonym` shown as a muted sub-label when present) followed by that group's phrase `CmRow`s. The existing `CmRow` / `FlagToggle` / `setCmFlag` wiring is reused unchanged.

- [ ] **Step 4: Type-check + build**

Run: `npm run type-check` → passes. `npm run build` → compiles.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/shaping.ts components/student/writing/shaping/cd-cm-shaping-bp-pane.tsx components/student/writing/shaping/pick-n-stitch-panel.tsx
git commit -m "feat(literary): shaping pick-n-stitch groups phrases under their CM word"
```

- [ ] **Step 6: Browser-verify (manual)** — literary Shaping shows phrases grouped/labelled by best word; `used_in_*` toggles still dim a phrase; non-literary modes unchanged.

---

## Task 8: CD-Analysis question constant (item d, TDD)

**Files:**
- Create: `lib/jswp-literary-cd-analysis.ts`
- Create: `lib/__tests__/jswp-literary-cd-analysis.test.ts`

**Interfaces:**
- Produces: `export const LITERARY_CD_ANALYSIS_QUESTIONS: readonly string[]` — the 13 verbatim questions (spec §5.2).

- [ ] **Step 1: Write the failing test**

`lib/__tests__/jswp-literary-cd-analysis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LITERARY_CD_ANALYSIS_QUESTIONS } from "../jswp-literary-cd-analysis";

describe("LITERARY_CD_ANALYSIS_QUESTIONS", () => {
  it("has exactly 13 questions (guide p.78-80)", () => {
    expect(LITERARY_CD_ANALYSIS_QUESTIONS).toHaveLength(13);
  });
  it("opens with the importance question and includes the thesaurus/synonym step", () => {
    expect(LITERARY_CD_ANALYSIS_QUESTIONS[0]).toMatch(/why is this cd important/i);
    expect(LITERARY_CD_ANALYSIS_QUESTIONS.some((q) => /thesaurus/i.test(q))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify it fails** (`npm run test:run -- jswp-literary-cd-analysis`): FAIL, module not found.

- [ ] **Step 3: Create the constant (verbatim, spec §5.2)**

```ts
/**
 * Dr. Louis's 13 CD-Analysis questions — "How to Generate Commentary."
 * Lifted verbatim from the Analytical Response to Literature guide, 4th ed.
 * (Sec_RL.pdf), p.78-80. Surfaced as a non-blocking helper on the Generating
 * Commentary (cm_dev) step. Do not edit the wording (CLAUDE.md §15.2).
 */
export const LITERARY_CD_ANALYSIS_QUESTIONS: readonly string[] = [
  "Why is this CD important (to the story / to the TS)?",
  "What does the CD show (in terms of the story / in terms of the TS)?",
  "Tell me more about that…",
  "The character feels ___ on the inside. (List as many words as possible.)",
  "Using the thesaurus, find synonyms for the words you listed above.",
  "Describe in your own words what it means to feel like that.",
  "Have you ever felt ___? What was it like? What caused it? Can you make a comparison between how you felt and how the character feels?",
  "What does it mean for the character to feel ___? Is it a change from how he or she used to be on the inside? What might that mean to the character?",
  "What is the character trying to feel by speaking these particular words or by taking this action? Why do you think he or she might want that?",
  "Is the character being influenced by anyone or trying to influence anyone?",
  "What moral or ethical strength or weakness is the character exhibiting in this moment?",
  "What strong connotative / feeling words does the author use in this quote? What images and ideas come to mind when you think of those words? How might those words shed some light on the character's current state of mind?",
  "Defend your choice of CD. Why is it a good CD? Why is it perfect for this paragraph?",
];
```

- [ ] **Step 4: Run — verify it passes** (`npm run test:run -- jswp-literary-cd-analysis`): PASS. `npm run type-check`: passes.

- [ ] **Step 5: Commit**

```bash
git add lib/jswp-literary-cd-analysis.ts lib/__tests__/jswp-literary-cd-analysis.test.ts
git commit -m "feat(literary): 13 CD-Analysis questions constant (verbatim, guide p.78-80)"
```

---

## Task 9: CD-Analysis helper panel on Generating Commentary (item d)

**Files:**
- Modify: `components/student/writing/cm-dev/cm-dev-bp-pane.tsx`

**Interfaces:**
- Consumes: `LITERARY_CD_ANALYSIS_QUESTIONS` (Task 8).

- [ ] **Step 1: Add a collapsible helper**

At the top of `CmDevBpPane`'s returned markup (above the per-CD sections), render a `<details>` "Need ideas? Ask yourself…" panel listing `LITERARY_CD_ANALYSIS_QUESTIONS` as an ordered list. Static, non-blocking, no new state. Use the same muted styling idiom as other helper text in the step. Import the constant from `@/lib/jswp-literary-cd-analysis`.

- [ ] **Step 2: Type-check + build** → both pass.

- [ ] **Step 3: Commit**

```bash
git add components/student/writing/cm-dev/cm-dev-bp-pane.tsx
git commit -m "feat(literary): CD-Analysis question helper on Generating Commentary"
```

---

## Task 10: Final-draft self-check items + pronoun regex (item e, TDD)

**Files:**
- Create: `lib/jswp-literary-final-checks.ts`
- Create: `lib/__tests__/jswp-literary-final-checks.test.ts`

**Interfaces:**
- Produces:
  - `export const LITERARY_FINAL_SELF_CHECKS: ReadonlyArray<{ key: string; label: string }>` — two items (LP, third-person).
  - `export function findFirstSecondPersonPronouns(text: string): string[]` — returns the matched pronouns (for a non-blocking nudge).

- [ ] **Step 1: Write the failing test**

`lib/__tests__/jswp-literary-final-checks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  LITERARY_FINAL_SELF_CHECKS,
  findFirstSecondPersonPronouns,
} from "../jswp-literary-final-checks";

describe("LITERARY_FINAL_SELF_CHECKS", () => {
  it("has the LP and third-person items", () => {
    const keys = LITERARY_FINAL_SELF_CHECKS.map((c) => c.key);
    expect(keys).toEqual(["literary_present_tense", "third_person"]);
  });
});

describe("findFirstSecondPersonPronouns", () => {
  it("flags whole-word first/second person pronouns, case-insensitive", () => {
    expect(findFirstSecondPersonPronouns("I think you can see we agree")).toEqual(
      ["I", "you", "we"]
    );
  });
  it("does not flag substrings inside other words", () => {
    expect(findFirstSecondPersonPronouns("The witty mews around us")).toEqual(["us"]);
    expect(findFirstSecondPersonPronouns("Iago mourns; yours truly")).toEqual(["yours"]);
  });
  it("returns empty for clean third-person prose", () => {
    expect(findFirstSecondPersonPronouns("The character feels trapped.")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify it fails** (`npm run test:run -- jswp-literary-final-checks`): FAIL.

- [ ] **Step 3: Implement**

```ts
/**
 * Final-draft self-check for Literary essays. The guide names literary present
 * tense (p.179) and third-person-only POV (first/second person "unacceptable,"
 * p.2784) as scoring criteria — so this is a NON-BLOCKING self-check, not a
 * grammar linter. The enumerated "no-no words" list is NOT in the guide and is
 * out of scope (CLAUDE.md §15.2).
 */
export const LITERARY_FINAL_SELF_CHECKS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "literary_present_tense", label: "Written in literary present tense (LP)" },
  { key: "third_person", label: "Third person only (no I / you / we)" },
];

const FIRST_SECOND_PERSON =
  /\b(I|me|my|mine|we|us|our|ours|you|your|yours)\b/gi;

/** High-confidence nudge: whole-word first/second-person pronouns in the draft. */
export function findFirstSecondPersonPronouns(text: string): string[] {
  const matches = text.match(FIRST_SECOND_PERSON);
  return matches ? Array.from(matches) : [];
}
```

- [ ] **Step 4: Run — verify it passes** (`npm run test:run -- jswp-literary-final-checks`): PASS. `npm run type-check`: passes.

- [ ] **Step 5: Commit**

```bash
git add lib/jswp-literary-final-checks.ts lib/__tests__/jswp-literary-final-checks.test.ts
git commit -m "feat(literary): final self-check items + first/second-person pronoun nudge (TDD)"
```

---

## Task 11: Wire the final-draft self-check + nudge (item e)

**Files:**
- Modify: `lib/queries/final-draft.ts` (surface `self_checks`)
- Modify: `lib/actions/final-draft.ts` (persist `self_checks`)
- Modify: `components/student/writing/final-draft/final-draft-client.tsx` (render checklist + nudge)

**Interfaces:**
- Consumes: `final_drafts.self_checks` (Task 2); `LITERARY_FINAL_SELF_CHECKS` + `findFirstSecondPersonPronouns` (Task 10); mode from props/`useWritingMode`.
- Produces: `updateFinalDraftSelfChecks(writingId: string, finalDraftId: string, selfChecks: string[]): Promise<void>`.

- [ ] **Step 1: Query — add `self_checks`**

In `lib/queries/final-draft.ts`, add `self_checks: string[] | null` to `FinalDraftRowData` and include `self_checks` in its select.

- [ ] **Step 2: Action — persist (mirror `revision_moves`)**

In `lib/actions/final-draft.ts` add (matching the file's `requireRole` + `revalidatePath` style):

```ts
export async function updateFinalDraftSelfChecks(
  writingId: string,
  finalDraftId: string,
  selfChecks: string[]
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("final_drafts")
    .update({ self_checks: selfChecks })
    .eq("id", finalDraftId);
  if (error) throw new Error(`Failed to save self-checks: ${error.message}`);
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
```

- [ ] **Step 3: Component — checklist + nudge (literary only)**

In `final-draft-client.tsx`, when the writing mode is `literary` and not read-only, render below the draft text:
- a self-check list from `LITERARY_FINAL_SELF_CHECKS`, modelled on shaping's `RevisionMovesChecklist` (optimistic `useState<readonly string[]>` seeded from `final_draft.self_checks ?? []`; toggle in a `useTransition` calling `updateFinalDraftSelfChecks(writingId, finalDraftId, [...next])`; revert on error; disabled in read-only);
- a non-blocking nudge: compute `findFirstSecondPersonPronouns(fullText)`; if non-empty, show an amber `role="status"` line: `` `Heads up — literary analysis is third person. Found: ${[...new Set(matches)].join(", ")}.` ``.

Import the constant + helper from `@/lib/jswp-literary-final-checks`. Read-only (teacher review) shows the checks as disabled, no nudge interactivity.

- [ ] **Step 4: Type-check + build** → both pass.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/final-draft.ts lib/actions/final-draft.ts components/student/writing/final-draft/final-draft-client.tsx
git commit -m "feat(literary): final-draft LP/third-person self-check + pronoun nudge"
```

- [ ] **Step 6: Browser-verify (manual)** — literary final draft shows the two self-check toggles (persist across reload) and the pronoun nudge when first/second-person pronouns are present; non-literary modes show neither.

---

## Final verification

- [ ] `npm run type-check` — passes.
- [ ] `npm run test:run` — passes (new tests: compute-gate, cd-analysis, final-checks; existing suite green except the env-gated `rls.test.ts`).
- [ ] `npm run build` — compiles.
- [ ] Manual browser pass on a **literary** writing end-to-end (gather → cm_dev helper → decisions → elaboration per-word → shaping grouped → final-draft self-check). Confirm non-literary modes are unchanged at cm_dev / shaping / final-draft.
- [ ] Move the BACKLOG item "Phrase-to-word linking on `commentary_items`" to **Closed** (this plan implements it via `parent_cm_id`).

---

## Self-review notes (author)

- **Spec coverage:** (a)=Task 1; (b)=Tasks 2–7 (migration, query, actions, gate, pane, shaping); (d)=Tasks 8–9; (e)=Tasks 2(col)+10–11. Item (c) intentionally deferred (spec §2). ✓
- **Type consistency:** `createPhraseCm(writingId, chunkId, parentCdId, parentCmId)`, `updateCmSynonym(writingId, cmId, synonym)`, `updateFinalDraftSelfChecks(writingId, finalDraftId, selfChecks)`, `LITERARY_CD_ANALYSIS_QUESTIONS`, `LITERARY_FINAL_SELF_CHECKS`, `findFirstSecondPersonPronouns` — names used consistently across tasks. ✓
- **Known cross-task compile coupling:** Task 4 (signature change) + Task 6 (caller) — flagged inline; fold into one commit if the runner requires green per commit. ✓
- **TDD targets:** the pure units (`computeGate`, the two constants/regex) are test-first; DB/query/component work is type-check + build + manual browser verify, consistent with this repo (jsdom can't exercise Supabase/canvas/selection). ✓
