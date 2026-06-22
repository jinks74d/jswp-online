# Literary WOW Per-Paragraph Fidelity — Design

> **Status:** Design approved 2026-06-22 (§A + §B, sections-by-section with the
> owner). First chunk of the **Literary (Response to Literature) build-out epic**
> grounded in `docs/reference/Sec_RL.pdf` ("Analytical Response to Literature,"
> 4th ed., June 2023). This spec covers the per-paragraph **WOW (Web-off-the-Word)**
> machinery only; the rest of the epic is deferred (see §8).
>
> Source of truth for pedagogy is the printed guide; every student-facing string
> below is **lifted verbatim** from it (page/line cited) per CLAUDE.md §15.2 —
> nothing invented.

---

## 1. Problem

The app's Literary mode already runs end-to-end with a guide-faithful *sequence*
(decode → annotate → gather CDs → generate commentary → make decisions →
elaboration → T-chart → shaping → [essay parts] → paragraph form → final). But a
fidelity audit against the 4th-edition guide (2026-06-22) found the per-paragraph
**WOW organizer** diverges from how the guide actually teaches it, plus three
adjacent component gaps and one outright contradiction:

1. **Contradiction** — the Gather-CDs hint says *"combine them into ONE sentence
   per chunk,"* but the guide is **1 CD : 2+ CM per chunk**: students circle the
   single best CD per chunk, never merge multiple CDs (guide p.46).
2. **WOW runs per CM word, not per CD.** The guide: *"Web off the Word for your
   CM1 idea… create your 1st CM sentence. Web off the Word for your CM2 idea…
   your 2nd CM sentence"* (guide p.131, line 3394). Each chosen CM word gets its
   own web: **word → synonym → 2+ "cloud" phrases** (p.48/82). The app drops the
   **synonym** and pools phrases flat under the CD (`parent_cd_id` only), so a
   student can't tell which phrases feed CM1 vs CM2. The `elaboration` component
   even *instructs* a synonym it never stores — a non-saving-input / spec-vs-schema
   conflict (the pattern MEMORY flags).
3. **No lead-in starter-word bank** on the quotation T-chart row (guide p.129).
4. **No CD-Analysis question helper** on Generating Commentary (the guide's
   13-question "How to Generate Commentary" bank, p.78–80).
5. **No literary-present-tense / third-person-POV self-check** on the final draft
   (guide scoring criteria, p.9/p.179/p.2784).

## 2. Scope

Delivers five items, all serving "make the per-paragraph WOW machinery faithful":

- **(a)** Fix the Gather-CDs hint contradiction.
- **(b)** Faithful WOW organizer: synonym + per-word phrase linkage. *(Core.)*
- **(c)** Lead-in starter-word bank on the quotation T-chart row.
- **(d)** CD-Analysis 13-question helper on Generating Commentary.
- **(e)** Final-draft self-check: literary present tense + third-person POV.

**Explicitly deferred** to their own specs (see §8): paraphrase/quotation
authoring split, Web-off-the-Topic-Sentence → concluding sentence, Discovering
Theme, Decoding-a-Text, Compare/Contrast (two texts), one/two-chunk progression,
and the enumerated **no-no-words** list (not present in this guide — content-blocked).

## 3. Item (a) — fix the Gather-CDs contradiction

Reword the literary `gather_cds` `pedagogyHint` in `lib/jswp-modes.ts` (currently
line ~383):

- **From:** *"List 3-5 concrete details from the text. For literary, you'll
  combine them into ONE sentence per chunk (1:2+). Drag to reorder."*
- **To:** *"List 3-5 concrete details from the text. Pick the single strongest CD
  for each chunk — one CD per chunk (1:2+). Drag to reorder."*

A `pedagogyHint` reword only — **not** a step add/remove, so it does **not** trip
the §15.3 step-list gate. No schema, no flow change.

## 4. Item (b) — faithful WOW organizer (the core)

### 4.1 Data model (decided: extend `commentary_items`)

`commentary_items` already holds both the CM **words** (`kind='word'`) and the
**phrases** (`kind='phrase'`). One new numbered migration adds:

```sql
ALTER TABLE commentary_items ADD COLUMN synonym TEXT;                 -- WOW box #2; meaningful on the best-word row
ALTER TABLE commentary_items ADD COLUMN parent_cm_id UUID
      REFERENCES commentary_items(id) ON DELETE CASCADE;             -- a phrase → the CM word it elaborates
CREATE INDEX idx_cms_parent_cm ON commentary_items(parent_cm_id);
```

- `parent_cd_id` **stays** (chunk/CD context); `parent_cm_id` is the new
  word→phrase link. A phrase row carries both: `parent_cd_id` (its CD) and
  `parent_cm_id` (its CM word).
- `synonym` is nullable; only the best-word rows (`is_best_word_for_chunk = true`)
  use it. Single column rather than a `kind='synonym'` row — it's a 1:1 attribute
  of the word, not an independently-commentable artifact.
- **RLS unchanged** — `commentary_items` policies scope via `chunk_id`
  (`0002_rls_policies.sql`), which both new columns inherit. No policy edit, no
  new `rls.test.ts` case (but the suite is re-run).
- Rejected alternatives: a dedicated `wow_webs` table (new RLS + plumbing for
  structure this table already holds) and a JSONB blob (violates §14.1; breaks
  per-phrase `used_in_*` pick-n-stitch flags and per-phrase comments).

This also closes the existing BACKLOG Open item *"Phrase-to-word linking on
`commentary_items`."*

### 4.2 Flow & pedagogy

- **`decisions` step (unchanged):** the student already picks the best CM word(s)
  per chunk (`is_best_word_for_chunk`). These are the WOW centers.
- **`elaboration` step (reworked):** render **per best word**, not flat per CD.
  Under each best word:
  - a **synonym** input → saves `commentary_items.synonym` on that word row
    (WOW box #2; guide p.48, and CD-Analysis Q5 *"Using the thesaurus, find
    synonyms for the words you listed above,"* p.79).
  - its **phrase** rows (`kind='phrase'`, `parent_cm_id = word.id`,
    `parent_cd_id = cd.id`) → WOW clouds #3. Prompt lifted verbatim: *"What does
    it mean to the character to ___?"* (guide p.82).
  - **Gating:** **≥2 phrases per best word** is required to advance (guide: "2+
    meaty phrases"); the **synonym is optional** (a thesaurus aid — not every
    word needs one), so the Continue gate keys on phrase count, not synonym.
- **`shaping` pick-n-stitch (adjusted):** still filters `kind='phrase'`, but
  groups phrases **under their CM word** so the student stitches CM1 from word-1's
  clouds and CM2 from word-2's clouds (guide p.131). Per-phrase `used_in_*` flags
  unchanged.

### 4.3 Units touched

- **Migration** — the `ALTER TABLE` above (validated with `pglast`, applied to
  live v2). *(jswp-database.)*
- **`lib/queries/commentary.ts`** — nest phrases under their word via
  `parent_cm_id`; surface `synonym`. Extend `CommentaryItemData` /
  `CommentaryBpData` (phrases nested under best words; `synonym` on word).
- **`lib/actions/commentary.ts`** — `createPhraseCm` gains a `parentCmId` param;
  new `updateCmSynonym(writingId, cmId, synonym)`.
- **`components/student/writing/elaboration/elaboration-bp-pane.tsx`** — render
  per best word (synonym input + that word's phrase list); replace the flat
  per-CD list. Remove the stale "Phase 7 backlog: parent_cm_id" comment.
- **Shaping pane + its query** — group the stitch-source phrases by CM word.

Each unit has one job and a clear interface (query returns nested shape →
component renders → action persists), so they're independently testable.

## 5. Items (c)(d)(e) — component enrichments

Independent of each other; each touches a different step. All buildable after
(b)'s migration lands (they don't depend on (b)'s logic, only avoid colliding on
the migration).

### 5.1 (c) Lead-in starter-word bank — T-chart quotation row

Component-only; `transitional_lead_in` / `source_citation` columns already exist.
In the T-chart CD editor, when a CD `is_quotation`, render a row of clickable
**starter words** that prefill the lead-in field. Verbatim list (guide p.129,
lines 4374/4377): **After · Although · As · Before · Since · When · While**
(*"Use one of these starter words to begin the lead-in,"* p.129). No schema, no
`jswp-modes.ts`.

### 5.2 (d) CD-Analysis question helper — Generating Commentary

A collapsible *"Need ideas? Ask yourself…"* panel on the `cm_dev` step listing the
guide's **13 CD-Analysis questions verbatim** (p.78–80, guide line 2978). Stored
as a typed constant `lib/jswp-literary-cd-analysis.ts` (`readonly` string array),
rendered as static helper content. No schema. The 13 (verbatim):

1. Why is this CD important (to the story/to the TS)?
2. What does the CD show (in terms of the story/in terms of the TS)?
3. Tell me more about that…
4. The character feels ___ on the inside. (List as many words as possible.)
5. Using the thesaurus, find synonyms for the words you listed above.
6. Describe in your own words what it means to feel like that.
7. Have you ever felt ___? What was it like? What caused it? Can you make a
   comparison between how you felt and how the character feels?
8. What does it mean for the character to feel ___? Is it a change from how he or
   she used to be on the inside? What might that mean to the character?
9. What is the character trying to feel by speaking these particular words or by
   taking this action? Why do you think he or she might want that?
10. Is the character being influenced by anyone or trying to influence anyone?
11. What moral or ethical strength or weakness is the character exhibiting in this
    moment?
12. What strong connotative/feeling words does the author use in this quote? What
    images and ideas come to mind when you think of those words? How might those
    words shed some light on the character's current state of mind?
13. Defend your choice of CD. Why is it a good CD? Why is it perfect for this
    paragraph?

### 5.3 (e) Final-draft self-check — literary present tense + third-person POV

The guide names these as scoring criteria (literary present tense, p.179;
*"third person… First and second person pronouns are unacceptable,"* p.2784) but
does **not** enumerate "no-no words." So this is a **non-blocking self-check**,
mirroring the Shaping `revision_moves` pattern — *not* automated grammar
detection:

- Two self-check toggles: *"Written in literary present tense (LP)"* /
  *"Third person only (no I / you / we)."*
- One **high-confidence, regex-detectable nudge**: highlight first/second-person
  pronouns (`I, me, my, mine, we, us, our, you, your, yours` — word-boundary,
  case-insensitive) as an advisory. No tense auto-detection (unreliable; would
  false-positive and erode trust).
- Storage: a new `final_drafts.self_checks TEXT[]` column (same shape as
  `shaping_sheets.revision_moves`), added in the same migration as §4.1.
- Read-only (disabled) in teacher review. The enumerated **no-no-words** list is
  **content-blocked** → BACKLOG item, not built here.

## 6. Testing

Per CLAUDE.md §8 (`lib/` ≥90%):

- **Unit (Vitest):** the WOW query nesting (phrases group under their
  `parent_cm_id` word; `synonym` surfaces); `createPhraseCm` parent-linkage; the
  first/second-person pronoun-nudge regex; the `gather_cds` hint string change if
  asserted anywhere.
- **Component:** happy-path render of the reworked per-word elaboration pane and
  the `cm_dev` helper panel.
- **RLS:** no new tables/policies; `commentary_items` policies already cover the
  new columns. Re-run `rls.test.ts` (no new case).
- **Migration:** `pglast`-validated; applied to live v2.

## 7. Build sequence (for the implementation plan)

| # | Step | Agent | Gate |
|---|---|---|---|
| 1 | (a) hint reword | jswp-frontend | none — lands first, trivial |
| 2 | (b) migration (`synonym`, `parent_cm_id`, `final_drafts.self_checks`) | jswp-database | §15 schema (cleared) |
| 3 | (b) queries → actions → elaboration component → shaping grouping | jswp-backend + jswp-frontend | sequential after the migration |
| 4 | (c) lead-in bank / (d) CD-Analysis helper / (e) final-draft self-check | jswp-frontend | parallel after step 2 |

## 8. Out of scope (future Literary-epic chunks)

Paraphrase-CD vs embedded-quotation-CD authoring split (+ separate gathering/
T-charts); Web-off-the-Topic-Sentence → concluding-sentence organizer;
Discovering Theme; Decoding-a-Text organizer; Compare/Contrast (two-text
assignments + compare thesis frames + two-story T-charts); one-chunk vs
two-chunk teaching progression; the enumerated literary **no-no-words** list
(needs its source handout — not in `Sec_RL.pdf`).

## 9. §15 gates (all cleared with the owner during design)

- **Schema migration** (`commentary_items.synonym`, `.parent_cm_id`;
  `final_drafts.self_checks`) — §15.6/.5. ✓
- **No step-list change** — (a) is a hint reword; nothing adds/removes a step
  (§15.3 not tripped). ✓
- **Content** — every student-facing string lifted verbatim from `Sec_RL.pdf`
  with a page cite; the one gap (no-no-words) is deferred, not invented
  (§15.2). ✓
