# Expository Mode — End-to-End Walk-Through

> **Purpose.** A scripted, reproducible run through the entire Expository flow,
> from teacher assignment creation through student final-draft submission and
> back to teacher review. Use it two ways:
>
> 1. **As a testing doc** — copy the inputs verbatim into the app; the
>    "Expected" notes at each step are your acceptance checks.
> 2. **As a teaching doc** — give it to a new district admin, principal, or
>    teacher who needs to see how the Jane Schaffer method maps onto the
>    JSWP Online UI without slogging through the printed guides.
>
> The walk-through targets the **2+:1** expository ratio with **essay format**
> and **source text**, so every step in `lib/jswp-modes.ts → EXPOSITORY_STEPS`
> appears. A "quick test" variant at the end strips the doc to a single
> paragraph for a faster smoke test.

---

## 0. Pre-flight

### 0.1 — Test accounts

These come from `migrations/0004_seed.sql` (passwords are dev-only):

| Role | Email | Password |
|---|---|---|
| Teacher | `teacher@demo.test` | `teacher-password-123` |
| Student | `alex@demo.test` | `student-password-123` |
| Student (2nd) | `bailey@demo.test` | `student-password-123` |
| Super admin | `super@demo.test` | `super-password-123` |

If `alex@demo.test` and `bailey@demo.test` aren't enrolled in a class period
that Teacher Demo also teaches, fix that in `/admin` before continuing.

### 0.2 — Environment

- App: `http://localhost:3000` (or the `v2` preview deployment).
- Browser: two windows side-by-side, one logged in as the teacher, one as
  `alex@demo.test`. A private/incognito window is the simplest way to keep
  the two sessions separate.
- DB: any new Supabase project that has all migrations applied through the
  most recent one in `migrations/`. See `CLAUDE.md §12`.

### 0.3 — Conventions in this doc

- **"Type X"** means literally type the quoted text into the field.
- **"Expected:"** describes what should happen on screen / in the DB.
- 🟦 = TS / CS · 🟥 = CD · 🟩 = CM · 🟨 = Thesis · ⬛ = Essay-only intro/conclusion.
- The walk-through assumes you fully complete each step before moving on.
  Auto-save is `onBlur`; if you click "Continue" without blurring the last
  field, that field still saves before navigation.

---

## 1. Teacher: create the assignment

### 1.1 — Sign in

1. Visit `/login`.
2. Email `teacher@demo.test`, password `teacher-password-123`. **Submit.**
3. Expected: redirect to `/dashboard`. You see the teacher dashboard with the
   demo class period(s).

### 1.2 — Start a new assignment

1. Click **Assignments** in the sidebar → **+ New assignment**
   (`/dashboard/assignments/new`).
2. On the mode picker, click the **Expository / Informational** card (owl
   icon).
3. Expected: URL becomes `/dashboard/assignments/new?mode=expository`. The
   form renders with the Expository defaults baked in (chunk ratio = 2+:1).

### 1.3 — Fill in the form

Enter each field exactly as written.

| Field | Value |
|---|---|
| **Title** | `How Regular Exercise Improves Teen Health` |
| **Prompt** | (see block below) |
| **Essay format** | ✅ checked |
| **Body paragraphs** | `3` |
| **Chunks per body paragraph** | `2` |
| **Chunk ratio** | `2+:1 — multiple details, single commentary` |
| **Source text** | (see block below, paste into `source_text`) |
| **Source title** | `Active Bodies, Active Minds: Why Teens Need to Move` |
| **Source author** | `Dr. Lena Ortega` |
| **Source citation** | `Ortega, L. (2024). Active Bodies, Active Minds. Journal of Adolescent Health, 18(2), 44–51.` |
| **Source URL** | *(leave blank)* |
| **Rubric** | Leave the default Expository rubric loaded by `loadRubric`. |
| **Due date** | Anything 7 days out. |
| **Class period** | Pick the demo class that contains `alex@demo.test`. |

**Prompt** — paste verbatim:

> In a multi-paragraph essay, explain how regular exercise improves teen
> health. Use evidence from the article *Active Bodies, Active Minds* and
> your own knowledge. Discuss at least three distinct benefits. Your essay
> should follow Jane Schaffer expository structure (2+:1 ratio, T-Chart and
> Shaping Sheet) and include a thesis, an introduction, three body
> paragraphs, and a conclusion.

**Source text** — paste verbatim into the `source_text` textarea (keep
paragraph breaks):

```
Adolescence is a window of rapid physical and cognitive growth, and one of
the most reliable ways to support that growth is regular physical activity.
The Centers for Disease Control recommends at least sixty minutes of
moderate-to-vigorous exercise on most days for teenagers. Despite that
guidance, fewer than one in four U.S. teens meet the standard, and the
shortfall begins as early as middle school.

The physical effects of consistent movement are well documented.
Cardiovascular endurance improves, resting heart rate drops, and muscles
gain both strength and flexibility. Teens who exercise four or more times a
week show measurably lower body-fat percentages and stronger bone density,
both of which set up healthier adulthoods. Exercise also helps the body
regulate blood sugar — a benefit that matters more every year as Type 2
diabetes rises in young people.

The mental-health story is just as striking. Even a thirty-minute walk
triggers a release of endorphins and reduces cortisol, the stress hormone
that disrupts sleep and focus. In a 2023 study of over two thousand
teenagers, those who exercised three or more times a week reported lower
levels of anxiety and depressive symptoms than their less-active peers.
Movement, in short, doesn't just shape the body; it stabilizes the mood.

There is a third, often overlooked benefit: school performance. Active
teens fall asleep faster and stay asleep longer, and well-rested teens
learn more efficiently. Teachers consistently report better focus and
classroom participation from students who play sports or exercise outside
school. Team activities, in particular, build social skills — cooperation,
communication, persistence — that translate directly into academic and
professional success.

The barriers to teen exercise are real: packed schedules, screen-time
gravity, and uneven access to safe spaces. But the evidence is unambiguous.
Regular movement is one of the highest-leverage habits an adolescent can
build, with returns that compound across the body, the mind, and the
classroom.
```

### 1.4 — Save the draft

1. Click **Save draft**.
2. Expected:
   - Green success banner ("Assignment saved as draft" or similar).
   - URL becomes `/dashboard/assignments/[uuid]` (edit mode).
   - In the DB: one row in `assignments` with `released_at IS NULL`,
     `mode = 'expository'`, `is_essay = true`, `num_body_paragraphs = 3`,
     `default_chunks_per_bp = 2`, `default_chunk_ratio = 'two_plus_to_one'`,
     `source_text` populated.

### 1.5 — Publish

1. Scroll to the **Danger zone**. Click **Publish**.
2. Confirm the native dialog ("Publishing makes this assignment visible to
   students…").
3. Expected:
   - Banner switches to "Published".
   - `assignments.released_at` is now a timestamp.
   - On the student account, the assignment becomes visible at
     `/student/assignments`. (Verify in the second browser window.)

---

## 2. Student: open the assignment

### 2.1 — Sign in

1. In the second browser window, log in as `alex@demo.test`.
2. Expected: redirect to `/student` or `/student/assignments`.

### 2.2 — Start the writing

1. Click the **How Regular Exercise Improves Teen Health** assignment card.
2. Expected: `/student/assignments/[id]` shows the title, the prompt, the
   source text, the due date, and a **Start writing** button.
3. Click **Start writing**.
4. Expected: a `student_writings` row is created with `draft_number = 1`,
   `chunk_ratio = 'two_plus_to_one'`, and `current_step =
   'expository.decode_prompt'`. The browser navigates to
   `/student/writings/[id]/decode-prompt`.

---

## 3. Step 1 — Decoding the Prompt 🦉

Goal: students extract structure from the prompt before writing a word.

### 3.1 — Inputs

| Field | Value |
|---|---|
| **Task** *(textarea)* | `Explain how regular exercise improves teen health. Use the article and my own knowledge to cover three distinct benefits.` |
| **Form** *(select)* | `Essay` |
| **Ratio identified** *(select)* | `2+:1 (CD : CM)` |
| **Key verbs** *(comma list)* | `explain, discuss, use, follow, include` |
| **Focus terms** *(comma list)* | `regular exercise, teen health, three benefits, expository structure, thesis, body paragraphs, conclusion` |
| **Notes** *(textarea)* | `Three benefits = three body paragraphs. Must cite the Ortega article at least once.` |

### 3.2 — Behavior to verify

- `onBlur` on any field briefly shows the "Saving…" → "Saved" flash.
- The **Continue** button is **disabled** until *Task* is non-empty.
- After clicking **Continue**, the page navigates to
  `/student/writings/[id]/annotate-text`.
- In the DB: one row in `prompt_decodings`, `step_progress` row for
  `expository.decode_prompt` is `complete = true`, and
  `student_writings.current_step` is now `expository.annotate_text`.

---

## 4. Step 2 — Reading & Annotating the Text 📑

Goal: students mark CDs (red) and CMs (green) in the source text so they
have raw material for Step 3.

### 4.1 — Annotations to create

The exact UI is a select-and-color tool. Highlight each span below and
tag it with the listed color. (Spans don't have to be perfect — close
matches are fine.)

| # | Span (highlight this text) | Color | Margin note |
|---|---|---|---|
| 1 | `at least sixty minutes of moderate-to-vigorous exercise on most days` | 🟥 CD | "CDC recommendation" |
| 2 | `fewer than one in four U.S. teens meet the standard` | 🟥 CD | "Stat — most teens fall short" |
| 3 | `Cardiovascular endurance improves, resting heart rate drops` | 🟥 CD | "Physical: heart" |
| 4 | `measurably lower body-fat percentages and stronger bone density` | 🟥 CD | "Physical: body comp + bones" |
| 5 | `release of endorphins and reduces cortisol` | 🟥 CD | "Mental: brain chemistry" |
| 6 | `lower levels of anxiety and depressive symptoms` | 🟥 CD | "Mental: mood study" |
| 7 | `Active teens fall asleep faster and stay asleep longer` | 🟥 CD | "Sleep → learning" |
| 8 | `cooperation, communication, persistence` | 🟥 CD | "Team sports → soft skills" |
| 9 | `Regular movement is one of the highest-leverage habits an adolescent can build` | 🟩 CM | "Author's thesis-like line" |

### 4.2 — Behavior to verify

- Each highlight inserts a `text_annotations` row scoped to this
  `student_writing_id` with `start_offset`, `end_offset`, and the chosen
  color/kind.
- Highlights persist on reload.
- The **Continue** button is enabled even with zero annotations (this is
  a non-blocking step per `required: true` but no minimum count), but the
  expected use is to have at least four red highlights before moving on.
- After **Continue**, navigate to
  `/student/writings/[id]/gather-cds` (with the BP context — see step 5).

---

## 5. Step 3 — Gathering & Prioritizing CDs 🟥

This step **repeats per body paragraph**. With `num_body_paragraphs = 3`,
the student does it three times. The router auto-scopes by BP — the URL
should carry a `bp` or chunk index in the query string (e.g.
`?bp=1`). The "Continue" button advances within the BP through the
remaining BP-scoped steps, then loops back to gather CDs for BP 2.

> **Tip while testing:** if the BP loop is confusing, complete *every*
> BP-scoped step (Gather → T-Chart → Shaping Sheet) for BP 1 first, then
> repeat for BP 2 and BP 3, then continue to the essay-level steps
> (Thesis → Intro → Conclusion → Paragraph Form → Final Draft).

### 5.1 — Body Paragraph 1: Physical health benefits

**Candidate CDs to add** (free-text — the student types each one):

| # | CD text | Highlight (use)? |
|---|---|---|
| 1 | `Cardiovascular endurance improves and resting heart rate drops with regular exercise.` | ✅ |
| 2 | `Teens who exercise four or more times a week show lower body-fat percentages and stronger bone density.` | ✅ |
| 3 | `Exercise helps the body regulate blood sugar, reducing the risk of Type 2 diabetes.` | ☐ |
| 4 | `The CDC recommends at least 60 minutes of moderate-to-vigorous exercise on most days for teenagers.` | ☐ |

After adding all four, drag-reorder so highlighted CDs (#1, #2) are at
the top. The two highlighted CDs are the ones that go into the T-Chart.

### 5.2 — Body Paragraph 2: Mental health benefits

| # | CD text | Highlight? |
|---|---|---|
| 1 | `A thirty-minute walk triggers a release of endorphins and reduces cortisol, the stress hormone.` | ✅ |
| 2 | `In a 2023 study, teens who exercised three or more times a week reported lower anxiety and depression than less-active peers.` | ✅ |
| 3 | `Exercise improves the regulation of mood-related neurotransmitters such as serotonin and dopamine.` | ☐ |
| 4 | `Movement gives anxious teens a constructive outlet that replaces unhealthy coping habits.` | ☐ |

### 5.3 — Body Paragraph 3: Academic & social benefits

| # | CD text | Highlight? |
|---|---|---|
| 1 | `Active teens fall asleep faster and stay asleep longer, and well-rested teens learn more efficiently.` | ✅ |
| 2 | `Team activities build cooperation, communication, and persistence — skills that translate into academic success.` | ✅ |
| 3 | `Teachers consistently report better focus and classroom participation from students who exercise outside school.` | ☐ |
| 4 | `Sports participation correlates with higher GPA averages in longitudinal studies.` | ☐ |

### 5.4 — Behavior to verify (per BP)

- Each added CD inserts a `candidate_cds` row tagged to the BP.
- The highlighted/order state persists in
  `gathering_cds_sheets.priority_order` (uuid array) plus
  `candidate_cds.is_used`.
- Drag-and-drop has a keyboard fallback (Tab focuses a card, Space picks
  it up, arrow keys reorder, Space drops).
- After "Continue", advance to the BP's T-Chart.

---

## 6. Step 4 — Completing the T-Chart 📋

This step **repeats per body paragraph**. With `chunks_per_bp = 2`, each
T-Chart has 2 chunks. Each chunk needs:

- 🟥 **2 CDs** (highlighted from Step 3 — pre-populated, editable)
- 🟩 **1 CM** that synthesizes both CDs
- 🟦 **Working TS** (top of the chart) and 🟦 **CS** (bottom)

### 6.1 — Body Paragraph 1 — Physical Health

**Working TS** (top of chart):
> `Regular exercise produces measurable physical benefits for teenagers,
> strengthening both the heart and the rest of the body.`

**Chunk 1**
- CD 1: `Cardiovascular endurance improves and resting heart rate drops with regular exercise.`
- CD 2: `Teens who exercise four or more times a week show lower body-fat percentages and stronger bone density.`
- CM: `Together, these changes give teens a stronger cardiovascular foundation and a healthier body composition, setting them up for fewer chronic illnesses in adulthood.`

**Chunk 2**
- CD 1: `Exercise helps the body regulate blood sugar, reducing the risk of Type 2 diabetes.`
- CD 2: `The CDC recommends at least 60 minutes of moderate-to-vigorous exercise on most days for teenagers.`
- CM: `Even modest, sustained activity changes the body's metabolic baseline, which is exactly why national guidance treats daily movement as non-optional health infrastructure for adolescents.`

> *Wait — Chunk 1 used CDs #1 and #2 from gather-cds. Chunk 2 promotes CDs
> #3 and #4 to "used" so both chunks have evidence. Students can edit any
> CD text inline on the T-Chart; the table is the working surface.*

**Revised TS** (after writing the chunks):
> `Regular exercise transforms a teenager's physical health from the
> cardiovascular system out to the cellular level.`

**Concluding sentence**:
> `When teens build a daily movement habit, their bodies develop the
> resilience that no amount of medication can replicate.`

### 6.2 — Body Paragraph 2 — Mental Health

**Working TS**:
> `Exercise also reshapes the way a teen feels day to day.`

**Chunk 1**
- CD 1: `A thirty-minute walk triggers a release of endorphins and reduces cortisol, the stress hormone.`
- CD 2: `Exercise improves the regulation of mood-related neurotransmitters such as serotonin and dopamine.`
- CM: `These biochemical shifts give the brain a more stable, less reactive baseline, which is why teens often report feeling "lighter" after a workout even when nothing else in their day has changed.`

**Chunk 2**
- CD 1: `In a 2023 study, teens who exercised three or more times a week reported lower anxiety and depression than less-active peers.`
- CD 2: `Movement gives anxious teens a constructive outlet that replaces unhealthy coping habits.`
- CM: `The combination of measurable mental-health gains and a healthier coping strategy makes physical activity one of the most effective non-clinical interventions adolescents have available.`

**Revised TS**:
> `Beyond the body, regular exercise actively stabilizes a teenager's
> mental and emotional health.`

**Concluding sentence**:
> `For a generation contending with record levels of anxiety, daily
> movement is less a luxury than a lifeline.`

### 6.3 — Body Paragraph 3 — Academic & Social

**Working TS**:
> `Active teens also do better in school and with each other.`

**Chunk 1**
- CD 1: `Active teens fall asleep faster and stay asleep longer, and well-rested teens learn more efficiently.`
- CD 2: `Teachers consistently report better focus and classroom participation from students who exercise outside school.`
- CM: `When sleep deepens and attention sharpens, the gains compound: every class period becomes more productive, and the academic returns far outlive any single workout.`

**Chunk 2**
- CD 1: `Team activities build cooperation, communication, and persistence — skills that translate into academic success.`
- CD 2: `Sports participation correlates with higher GPA averages in longitudinal studies.`
- CM: `Long-term studies confirm what coaches have always suspected: the habits an athlete builds on the field — showing up, working with others, finishing the play — are the same habits that produce strong students and, eventually, strong employees.`

**Revised TS**:
> `The benefits of regular exercise extend into the classroom and into a
> teenager's relationships with peers.`

**Concluding sentence**:
> `In the end, exercise pays dividends in places no gym membership
> advertises — the report card, the friend group, and the future résumé.`

### 6.4 — Behavior to verify (per BP)

- One `t_charts` row per BP; two `chunks` rows under it (chunk_index 1, 2).
- Each chunk has two `concrete_details` rows and one `commentary_items`
  row.
- The 2+:1 chunk ratio is enforced visually (red column wider, green
  column narrower, two CD rows per chunk). See
  `docs/reference/expository-organizer-specs.md`.
- After completing all three BPs' T-Charts, the writing advances to BP 1's
  Shaping Sheet.

---

## 7. Step 5 — Editing & Revising on the Shaping Sheet ✂️

Repeats per body paragraph. The Shaping Sheet is the *revision* artifact:
students "move and improve" their T-Chart sentences, apply grammar rules,
and follow the **"once you use it, you lose it"** rule (no word repetition
across sentences within a chunk).

### 7.1 — Body Paragraph 1 — Polished sentences

| Slot | Final sentence |
|---|---|
| 🟦 Final TS | `Regular exercise transforms a teenager's physical health from the cardiovascular system outward.` |
| 🟥 CD1 (chunk 1) | `According to the CDC's adolescent guidance, sustained activity strengthens the heart, lowers the resting pulse, and improves both muscle strength and flexibility.` |
| 🟥 CD2 (chunk 1) | `Teens who train four or more times a week show lower body-fat percentages and noticeably stronger bone density.` |
| 🟩 CM (chunk 1) | `Together, these changes give an adolescent body the cardiovascular foundation and structural integrity that protect against chronic illness for decades.` |
| 🟥 CD1 (chunk 2) | `Daily movement also helps the body regulate blood sugar, which lowers the rising risk of Type 2 diabetes in young people.` |
| 🟥 CD2 (chunk 2) | `That is precisely why national guidance treats sixty minutes of moderate activity as non-optional health infrastructure for teenagers.` |
| 🟩 CM (chunk 2) | `Modest, sustained effort resets the body's metabolic baseline — a quiet revolution that changes a teen's long-term health trajectory.` |
| 🟦 Final CS | `When adolescents build a daily movement habit, their bodies develop the kind of resilience medicine cannot prescribe.` |

**Grammar rules applied** (multi-select on the Shaping Sheet):
- ✅ Vary sentence openings.
- ✅ Once you use it, you lose it (no word repeats across CD/CM in a chunk).
- ✅ Use active voice.
- ✅ Embed transitions ("Together…", "Daily movement also…").

### 7.2 — Body Paragraphs 2 & 3 — Polished sentences

Repeat the same exercise. Acceptable shapes:

**BP 2 final sentences (one of many valid versions):**
- 🟦 TS — `Beyond the body, consistent movement stabilizes a teenager's mental health.`
- 🟥 CD1.1 — `Even a thirty-minute walk triggers an endorphin release and lowers cortisol, the stress hormone behind disrupted sleep and scattered focus.`
- 🟥 CD1.2 — `Sustained activity also helps the brain regulate serotonin and dopamine, the chemistry of stable mood.`
- 🟩 CM1 — `These quiet biochemical shifts give an adolescent brain a less reactive baseline — the reason teens often feel "lighter" after exercising, even when nothing else in their day has changed.`
- 🟥 CD2.1 — `A 2023 study of more than two thousand teens reported notably lower anxiety and depressive symptoms among those who exercised three or more times each week.`
- 🟥 CD2.2 — `For anxious adolescents, that movement also replaces less healthy coping habits with a productive outlet.`
- 🟩 CM2 — `Few non-clinical interventions match this combination of measurable relief and durable habit formation.`
- 🟦 CS — `For a generation contending with record anxiety, daily activity is less a luxury than a lifeline.`

**BP 3 final sentences (one of many valid versions):**
- 🟦 TS — `Regular exercise also pays dividends in the classroom and the friend group.`
- 🟥 CD1.1 — `Active teens fall asleep faster and stay asleep longer, and well-rested students learn more efficiently the next day.`
- 🟥 CD1.2 — `Teachers consistently note sharper focus and stronger participation from students who train outside school hours.`
- 🟩 CM1 — `When sleep deepens and attention sharpens, every class period becomes more productive — academic returns that far outlive any single workout.`
- 🟥 CD2.1 — `Team sports, in particular, build cooperation, clear communication, and persistence under pressure.`
- 🟥 CD2.2 — `Longitudinal studies confirm a steady GPA advantage for student-athletes over their non-active peers.`
- 🟩 CM2 — `The habits an adolescent builds on the field — showing up, listening, finishing the play — are the same habits that produce strong students and, eventually, strong employees.`
- 🟦 CS — `Exercise pays dividends in places no gym advertises: the report card, the friend group, and the future résumé.`

### 7.3 — Behavior to verify

- Each BP creates a `shaping_sheets` row with `rules_applied` containing the
  selected rule keys.
- Each chunk creates a `shaping_chunk_outputs` row with `final_ts`,
  `final_cd1`, `final_cd2`, `final_cm`, `final_cs`.
- The "Once you use it, you lose it" linter (if implemented) flags
  duplicate words across slots in the same chunk.
- After all three BPs' Shaping Sheets are complete, the student advances
  to the essay-level steps.

---

## 8. Step 6 — Thesis Statement 🟨

Single screen, essay-only. The thesis is the highlighter-yellow seed for
the whole essay.

**Type into the Thesis field:**
> `Regular exercise transforms teen health on three fronts at once: it
> strengthens the body, stabilizes the mind, and sharpens performance in
> school and in friendships.`

### Behavior to verify
- One `essay_parts` row with `kind = 'thesis'` is upserted.
- After "Continue", navigate to `/student/writings/[id]/introduction`.

---

## 9. Step 7 — Introduction ⬛

All commentary, no concrete detail. Black ink in print; the digital UI
should render in the `--jswp-black` token.

**Type into the Introduction field:**
> `Adolescence is one of the most rapid growth periods in a human life,
> and few habits shape it more decisively than regular movement. Doctors,
> teachers, and coaches rarely agree on much, but on this they line up:
> teens who exercise consistently grow stronger, calmer, and sharper than
> teens who do not. Yet fewer than one in four American teenagers meet
> the national guideline of an hour of daily activity, and the gap widens
> every year. The cost of that gap is not abstract — it shows up in the
> doctor's office, in the bedroom at midnight, and on the report card.
> Regular exercise transforms teen health on three fronts at once: it
> strengthens the body, stabilizes the mind, and sharpens performance in
> school and in friendships.`

### Behavior to verify
- `essay_parts` row with `kind = 'introduction'` upserted.
- The thesis appears as the final sentence (good practice; not enforced).

---

## 10. Step 8 — Conclusion ⬛

Restate the thesis without repeating it; broaden out.

**Type into the Conclusion field:**
> `The evidence is unambiguous and the mechanism is simple. A teen who
> walks, runs, lifts, or plays for an hour most days will, on average, be
> healthier in body, steadier in mind, and stronger in the classroom than
> a teen who does not. None of the gains require special equipment, a
> coach, or a membership; they require only the decision to move, and to
> keep moving. In a culture built to keep adolescents seated, that
> decision is harder than it sounds — but no other single habit pays as
> many compounding dividends across an adolescent's body, brain, and
> future. The case is closed: teen health, in the broadest sense of the
> phrase, is built one workout at a time.`

### Behavior to verify
- `essay_parts` row with `kind = 'conclusion'` upserted.

---

## 11. Step 9 — Paragraph Form 🎨

Repeats per body paragraph. This is the *assembled, color-coded*
paragraph — the visual proof the student followed the method.

For each BP, the screen shows the Shaping Sheet output as one continuous
paragraph with each sentence rendered in its JSWP color:

- 🟦 TS — blue
- 🟥 CDs — red
- 🟩 CMs — green
- 🟦 CS — blue

The student does **not** retype here; this is a "read and confirm"
artifact. The system stitches the Shaping Sheet sentences in order.

### Behavior to verify
- One `paragraph_forms` row per BP.
- The print stylesheet (`@media print { print-color-adjust: exact; }`)
  preserves colors.
- "Continue" on the last BP's Paragraph Form advances to the Final
  Draft step.

---

## 12. Step 10 — Final Draft 📄

Single screen, essay-only. The assembled essay: black introduction,
three color-coded body paragraphs, black conclusion. The student reads it,
optionally tweaks transitions between paragraphs, and submits.

### 12.1 — Final assembly preview

The expected output is approximately:

> **Introduction (⬛ black).** Adolescence is one of the most rapid growth
> periods in a human life… *[full intro from §9]*
>
> **Body 1 (color-coded).** 🟦 Regular exercise transforms a teenager's
> physical health from the cardiovascular system outward. 🟥 According to
> the CDC's adolescent guidance, sustained activity strengthens the
> heart… 🟩 Together, these changes give an adolescent body the
> cardiovascular foundation… 🟦 When adolescents build a daily movement
> habit, their bodies develop the kind of resilience medicine cannot
> prescribe.
>
> **Body 2 (color-coded).** *[full BP2 from §7.2]*
>
> **Body 3 (color-coded).** *[full BP3 from §7.2]*
>
> **Conclusion (⬛ black).** *[full conclusion from §10]*

### 12.2 — Submit

1. Click **Submit final draft**.
2. Confirm the native dialog.
3. Expected:
   - `student_writings.status` flips to `submitted` (or whatever the
     enum spelling is; see `database.types.ts`).
   - `student_writings.submitted_at` is set.
   - Read-only mode kicks in via `useWritingMode().isReadOnly = true`.
   - Browser navigates to a submission confirmation screen
     (`/student/writings/[id]` or similar).

---

## 13. Teacher: review and grade

### 13.1 — Open the writing

1. Back in the teacher window, go to **Assignments → How Regular Exercise
   Improves Teen Health → Writings** (or click the new "1 submitted" badge
   on the dashboard).
2. Expected URL: `/dashboard/assignments/[id]/writings`. One row listed
   for `alex@demo.test`, status "Submitted".
3. Click the row → `/dashboard/assignments/[id]/writings/[writingId]`.

### 13.2 — Walk through every artifact

For each step (Decode → Annotate → Gather CDs ×3 → T-Chart ×3 → Shaping
Sheet ×3 → Thesis → Intro → Conclusion → Paragraph Form ×3 → Final Draft),
verify:

- The teacher can **read** the saved data.
- The teacher can **leave a comment** on the artifact via
  `teacher_feedback` (target_kind matches the artifact: `student_writing`,
  `concrete_detail`, `commentary_item`, `t_chart`, `shaping_sheet`,
  `paragraph_form`, `final_draft`).
- Sample comments to leave:
  - On CD #1.1 (Cardiovascular endurance): "Great choice — clinical
    detail that lands."
  - On CM #2.1 (mental health chunk 1 CM): "Nice — the 'lighter' image
    is vivid."
  - On the Shaping Sheet for BP 3: "Watch the repetition of 'sharpen' —
    swap one for 'focus'."
  - On the writing as a whole: "Strong essay. Submission accepted."

### 13.3 — Score with the rubric

1. Open the rubric panel.
2. Score each criterion. With the default Expository rubric, expected
   criteria are something like *Content*, *Structure*, *Color Code*,
   *Conventions* — see `lib/jswp-rubrics.ts` for the exact shape.
3. Submit the score. Expected: a `rubric_scores` row (or whatever the
   table is called in `0001`) per criterion, plus a final aggregated
   score on the writing.

### 13.4 — Return to student

1. Click **Return**.
2. Expected:
   - `student_writings.status` flips to `returned`.
   - The student sees the teacher feedback inline on each artifact when
     they re-open the writing.
   - If the assignment had `allow_multiple_drafts = true`, the student
     can start draft 2 (out of scope for this walk-through).

---

## 14. Verification checklist

Print or copy this to track a clean run.

### Teacher creation
- [ ] Mode picker → Expository renders correctly.
- [ ] Form shows source-text fields (no Narrative behavior).
- [ ] Form does **not** show counterargument checkbox (that's argumentation).
- [ ] Defaults: chunk ratio `2+:1`, chunks per BP `1`, is_essay `false`.
- [ ] Toggling Essay on bumps `num_body_paragraphs` to 2 minimum.
- [ ] Save draft succeeds; URL changes to `/dashboard/assignments/[id]`.
- [ ] Publish hides the publish button and shows Unpublish.
- [ ] Student window sees the assignment after publish (refresh required if
      cached).

### Student writing
- [ ] Start writing creates `student_writings` row with `draft_number = 1`.
- [ ] Reachability gate works: pasting
      `/student/writings/[id]/final-draft` before completion redirects to
      the current step.
- [ ] Decode Prompt — Continue disabled until task is non-empty.
- [ ] Annotate — at least one CD highlight persists.
- [ ] Gather CDs — repeats 3 times (one per BP); drag reorder persists.
- [ ] T-Chart — 2 chunks per BP; CD column wider than CM column (2+:1).
- [ ] Shaping Sheet — `final_*` slots persist; rule chips toggleable.
- [ ] Thesis, Intro, Conclusion render essay-only screens.
- [ ] Paragraph Form — color-coded display, no edit.
- [ ] Final Draft — full essay preview, Submit confirms and locks.

### Teacher review
- [ ] `/dashboard/assignments/[id]/writings` shows 1 submitted row.
- [ ] Each artifact is readable and commentable.
- [ ] Comments save against the right `target_kind` + `target_id`.
- [ ] Rubric scoring persists.
- [ ] Return flips status to `returned`.

### Data integrity (run in Supabase SQL editor)
```sql
SELECT id, current_step, status, draft_number
  FROM student_writings
 WHERE assignment_id = '<assignment_id>';

SELECT COUNT(*) FROM candidate_cds
  WHERE student_writing_id = '<writing_id>'; -- expect 12 (4 per BP × 3 BP)

SELECT COUNT(*) FROM chunks
  WHERE body_paragraph_id IN (
    SELECT id FROM body_paragraphs WHERE student_writing_id = '<writing_id>'
  ); -- expect 6 (2 chunks per BP × 3 BP)

SELECT COUNT(*) FROM concrete_details
  WHERE chunk_id IN (
    SELECT id FROM chunks WHERE body_paragraph_id IN (
      SELECT id FROM body_paragraphs WHERE student_writing_id = '<writing_id>'
    )
  ); -- expect 12 (2 CDs per chunk × 6 chunks)

SELECT COUNT(*) FROM commentary_items
  WHERE chunk_id IN (
    SELECT id FROM chunks WHERE body_paragraph_id IN (
      SELECT id FROM body_paragraphs WHERE student_writing_id = '<writing_id>'
    )
  ); -- expect 6 (1 CM per chunk × 6 chunks)
```

---

## 15. Quick-test variant (single paragraph, ~10 min)

When you just need a smoke test, change the teacher setup to:

- **Essay format:** ☐ unchecked
- **Chunks per BP:** *(field hidden because not an essay)*
- **Chunk ratio:** `2+:1`
- **Source text:** still required (so the Annotate step runs).

Then on the student side, do **BP 1 only** from this doc (Gather CDs §5.1,
T-Chart §6.1, Shaping Sheet §7.1, Paragraph Form for BP 1). Skip Thesis,
Intro, Conclusion, and Final Draft — they don't appear in single-paragraph
mode. Total: ~5 steps, ~10 minutes.

---

## 16. Known sharp edges

These are not bugs to file — they're things you should *not* be surprised
by:

- The Annotate step has no minimum highlight count, so you can technically
  blow past it without highlighting anything. If you do, the Gather CDs
  step loses some context but still works.
- Drag reorder on Gather CDs may flicker on the first drop after a fresh
  load (mount animation). Doesn't affect persistence.
- The Paragraph Form screen is currently read-only — color rendering is
  driven by the upstream Shaping Sheet, so any typos in Shaping carry
  through. Fix at the source.
- `print-color-adjust: exact` works in Chrome/Edge; Firefox honors it but
  Safari's print dialog may strip background colors. Test on Chrome for
  this walk-through.

---

## 17. Source-of-truth references

- Step list & ordering: `lib/jswp-modes.ts → EXPOSITORY_STEPS`
- Schema: `migrations/0001_init_jswp_schema.sql`
- RLS: `migrations/0002_rls_policies.sql`
- Organizer layouts: `docs/reference/expository-organizer-specs.md`
- Method primer: `CLAUDE.md §4`
- Printed guide: `docs/2023-2024JSWP-Expository-GuideFNL5-hires.pdf`,
  pp. 36–72

---

*Last updated: 2026-05-19. Update when any expository step is renamed,
added, removed, or its required-fields change.*
