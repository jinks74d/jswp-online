# Essay-frame wording — Dr. Louis sign-off packet

**For:** Dr. Deborah Louis · **Prepared by:** Raymond · **Date:** 2026-07-02
**Purpose:** The app's **Expository essay steps** (Thesis, Introduction, Conclusion) currently show wording transcribed from the 2024 Expository guide (pp. 117–128). It is **provisional** and gated before it merges to the production app. Please confirm each item below — a ✅ if the wording is faithful to the program, or a correction in the blank. Only the **Expository** mode is in question; Argumentation / Literary / Narrative wording is unchanged and not under review here.

> How to read this: each item shows the **exact text a student sees on screen**, the guide page it came from, and one specific question. Mark ✅ or write the fix.

---

## A. Thesis step

### A1. The two Expository thesis-frame choices (guide pp. 117–118)
The student picks one from a dropdown labeled **"Thesis frame"**, with helper line *"Framed names each body paragraph's topic; open does not."* The two options:

| On-screen label | On-screen description |
|---|---|
| **Open thesis** | "Don't name the paragraph topics — a general statement of your point." |
| **Framed thesis** | "Name each body paragraph's topic in the thesis (e.g., by A, B, and C)." |

**Q1.** Are the labels **"Open thesis" / "Framed thesis"** and these descriptions correct program language?
☐ ✅ as-is ☐ Change to: ________________________________________________

### A2. "Framed" for any number of body paragraphs? (technical, but needs your intent)
Right now "Framed thesis" internally reuses the existing **three-pronged** structure (three named reasons). If a framed expository essay can name **2, 4, or 5** body-paragraph topics — not only three — we should add a distinct "framed" type that isn't tied to the number three.

**Q2.** Should "Framed thesis" support **any** number of named body paragraphs (not just three)?
☐ Yes — any number ☐ No — framed always means three ☐ Other: ______________

### A3. "Flip the Prompt" beginner helper (guide pp. 117–118)
Shown as an expandable "Need a starting point? Try 'Flip the Prompt.'" It contains:

> Turn the prompt into a thesis by filling in this frame:
> **In \<Author>'s "\<Title>," \<subject> \<your explanation>.**
>
> Example: *In Kate Kinsella's "When Women Rushed for Gold," two women of the Alaskan Gold Rush are known for their accomplishments.*

**Q3a.** Is the **frame** ("In \<Author>'s "\<Title>," \<subject> \<your explanation>.") correct?
☐ ✅ as-is ☐ Change to: ________________________________________________

**Q3b.** Is the **example** acceptable, or should we use a canonical example from the guide?
☐ ✅ as-is ☐ Use instead: ____________________________________________

### A4. Thesis textarea helper line
Under the thesis box: *"One sentence: your subject + your explanation. Place it as the last sentence of your introduction."*

**Q4.** Correct?  ☐ ✅ as-is ☐ Change to: ______________________________

---

## B. Introduction step

### B1. The five Expository "How to Begin" openers (guide p. 119)
Dropdown labeled **"How to begin"**, helper *"Which kind of opening will pull the reader in?"*. The five options:

| On-screen label | On-screen description |
|---|---|
| **Historical background** | "Open with the history or significance of the topic." |
| **Current event** | "A recent event that has prompted discussion of the topic." |
| **Quotation** | "A quotation related to the topic." |
| **Question or problem** | "A question or problem related to the topic." |
| **Startling fact** | "A dramatic or startling statistic, statement, or fact." |

**Q5.** Are these the **correct five openers**, with correct labels and descriptions?
☐ ✅ as-is ☐ Corrections: ______________________________________________

### B2. Introduction pedagogy + inverted-pyramid helper (guide pp. 119–122)
- Blue hint band: *"Begin broadly. Narrow to your thesis. The introduction is all commentary — written in black for an essay."*
- Textarea helper: *"Inverted pyramid: begin broad, then narrow. Open with your perspective, say more about it, and end with your thesis as the last sentence."*

**Q6.** Is this framing correct?  ☐ ✅ as-is ☐ Change to: __________________

### B3. Design question — full 3-part intro scaffold?
Today the introduction is a **single textarea** with the pyramid described in the helper. The guide teaches it as three moves: **(1) perspective → (2) say more → (3) thesis**. We *could* split it into three separate labeled inputs so students build each move explicitly.

**Q7.** Should the intro be **three separate inputs** (perspective / say-more / thesis), or is **one box with guidance** sufficient?
☐ Three inputs ☐ One box is fine ☐ Other: ______________________________

---

## C. Conclusion step

### C1. Conclusion pedagogy + helper (guide pp. 126–128)
- Blue hint band: *"Restate (don't repeat) the thesis. Broaden out. Provide a finished feeling."*
- Textarea helper: *"Restate the thesis (don't repeat it). Broaden out. Provide a finished feeling."*

**Q8.** Correct?  ☐ ✅ as-is ☐ Change to: ______________________________

### C2. Design question — narrow→broad conclusion pyramid?
Like the intro, the conclusion is a **single textarea** today. The guide (pp. 126–128) teaches a narrow→broad pyramid. We could split it into separate section inputs.

**Q9.** Separate section inputs for the conclusion, or **one box with guidance**?
☐ Separate inputs ☐ One box is fine ☐ Other: ______________________________

---

## What happens with your answers
- **✅ everywhere** → the wording ships as-is; the merge gate lifts.
- **Wording changes (Q1, Q3, Q4, Q5, Q6, Q8)** → small text edits, no schema change; quick to apply.
- **Q2 "any number" = Yes** → a small database enum addition (a distinct "framed" value).
- **Q7 / Q9 = separate inputs** → a larger build (new fields + UI); we'd schedule those as their own chunks. Answering "one box is fine" keeps the current design and closes them.

_Source of all quoted text: `app/student/writings/[id]/_steps/{thesis,introduction,conclusion}-step.tsx` and `lib/jswp-modes.ts`, transcribed from the 2024 Expository guide pp. 117–128 in chunk 4.5f-4._
