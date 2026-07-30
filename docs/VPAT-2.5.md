# Accessibility Conformance Report — JSWP Online

### VPAT® Version 2.5 — WCAG 2.2 Edition

---

## Product Information

| Field | Value |
|---|---|
| **Name of Product / Version** | JSWP Online (Jane Schaffer Academic Writing Program) — rebuild, branch `v2` |
| **Report Date** | 2026-07-14 |
| **Product Description** | Web application for K–12 districts implementing the Jane Schaffer Academic Writing Program. Teachers author and grade structured writing assignments; students complete the writing flow (decode prompt → annotate → gather details → T-chart → shaping sheet → paragraph form). Multi-tenant, district-branded. |
| **Contact Information** | *[Fill in accessibility contact — e.g. accessibility@janeschaffer.com]* · Publisher: Louis Educational Concepts, Dallas TX · Marketing: janeschaffer.com |
| **Notes** | Assessment scope: application UI (auth, admin/district/school consoles, teacher dashboard, student writing flow, shared components). Excludes third-party embedded content (e.g. teacher-uploaded PDF source documents rendered via pdf.js) and teacher-authored content, whose accessibility is the responsibility of the authoring party. |
| **Evaluation Methods Used** | (1) Manual static source-code review of all 228 UI component/route files against WCAG 2.2 A/AA success criteria. (2) Pattern analysis for common failures (color-only signaling, missing labels, focus management, target size, keyboard operability). (3) Remediation with `tsc` type-check and unit/component test verification. (4) **Dynamic validation of the running app (2026-07-14):** Lighthouse (axe-core) accessibility audits and accessibility-tree inspection, plus functional keyboard/pointer exercises. Surfaces audited at **100/100** Lighthouse accessibility: `/login`, student dashboard, and the full student writing flow end-to-end — Decode, Reading & Annotate, Gather-CDs, T-Chart (both Narrative-WOW and Expository), Shaping Sheet, Paragraph Form — plus the teacher Assignment Builder and the teacher **Grade-Writing** page. Exercised end-to-end: keyboard annotation *create* (Tab-to-sentence → Enter → form → save) and *edit* (`<mark>` as focusable button); the drag **and** ▲/▼ non-drag reorder (with a real reorder); the grade-format `aria-pressed` toggle; and a complete student submission → teacher review. **Seven defects surfaced by this pass were fixed** (disabled-state button contrast; nine unlabeled WOW T-chart fields; opacity-reduced commentary hint contrast; an h3→h2 heading-order skip; unlabeled shaping sentence inputs; and muted `text-gray-500` labels failing 4.5:1 on the grading page's tinted background, in two components). **Scope note:** this assessment used automated and functional-interaction testing; manual screen-reader testing (JAWS/NVDA/VoiceOver), voice control, 400% zoom/reflow verification, and testing with users with disabilities are recommended as ongoing periodic validation. |

---

## Applicable Standards / Guidelines

This report covers the following accessibility standard:

| Standard / Guideline | Included in Report |
|---|---|
| Web Content Accessibility Guidelines (WCAG) 2.2, Level A | Yes |
| Web Content Accessibility Guidelines (WCAG) 2.2, Level AA | Yes |
| Web Content Accessibility Guidelines (WCAG) 2.2, Level AAA | Not evaluated (not a conformance target) |

WCAG 2.2 success criteria at Levels A and AA also map to **Revised Section 508**
(36 CFR 1194, Appendix A, Chapter 5 §501.1 / 508 incorporation of WCAG 2.0/2.1)
and **EN 301 549 v3.2.1 (Chapter 9)**. A Section 508 or EN 301 549 (INT) edition
of this VPAT can be derived from the WCAG results below once AT validation is
complete.

---

## Terms

The terms used in the Conformance Level column are defined as follows:

- **Supports** — The functionality of the product has at least one method that meets the criterion without known defects, or meets with equivalent facilitation.
- **Partially Supports** — Some functionality of the product does not meet the criterion.
- **Does Not Support** — The majority of product functionality does not meet the criterion.
- **Not Applicable** — The criterion is not relevant to the product.
- **Not Evaluated** — The product has not been evaluated against the criterion. (Used only where noted; permitted for Level AAA.)

---

## WCAG 2.2 Report

Tables below record conformance for **Level A** and **Level AA** success criteria.
Remarks describe the current implementation and any known remaining gaps
(tracked for remediation).

### Table 1: Success Criteria, Level A

| Criteria | Conformance Level | Remarks and Explanations |
|---|---|---|
| **1.1.1 Non-text Content** (A) | Supports | Icon-only buttons carry `aria-label`; decorative icons are `aria-hidden`. Images (district logos, brand images) provide meaningful `alt`; the reusable image component requires an `alt` prop. The color-code role tags render a shape + visually-hidden text label. |
| **1.2.1 Audio-only and Video-only (Prerecorded)** (A) | Not Applicable | The application UI contains no pre-recorded audio-only or video-only content. |
| **1.2.2 Captions (Prerecorded)** (A) | Not Applicable | No pre-recorded synchronized media in the application UI. |
| **1.2.3 Audio Description or Media Alternative (Prerecorded)** (A) | Not Applicable | No pre-recorded synchronized media in the application UI. |
| **1.3.1 Info and Relationships** (A) | Supports | Form fields use programmatic labels (`<label for>` / `aria-label`); radio groups use `<fieldset>`/`<legend>`; data tables use `<th scope>`; heading hierarchy (h1→h2→h3) is consistent; landmark regions (`header`/`nav`/`main`/`aside`) are used. |
| **1.3.2 Meaningful Sequence** (A) | Supports | DOM order matches visual reading order; no CSS-positioning reorderings that alter meaning were found. |
| **1.3.3 Sensory Characteristics** (A) | Supports | Instructions do not rely solely on shape, size, or position. The JSWP color code is always paired with a non-color signal (shape glyph + text/`sr-only` label). |
| **1.4.1 Use of Color** (A) | Supports | Segmented toggles (grade format, approve/deny) expose `aria-pressed`; rubric selection adds a `✓` marker + focus ring; status badges pair color with text. Annotation highlight kinds each carry a distinct underline *line style* — solid (main idea), dotted (concrete detail), dashed (commentary), wavy (transition), double (note) — so kind is distinguishable without perceiving color. |
| **1.4.2 Audio Control** (A) | Not Applicable | No auto-playing audio. |
| **2.1.1 Keyboard** (A) | Supports | All interactive controls are keyboard operable. Text annotations can be created (sentence-level targets), edited, and deleted by keyboard. Candidate reordering provides a keyboard sortable sensor plus explicit move controls. |
| **2.1.2 No Keyboard Trap** (A) | Supports | Modal dialogs intentionally trap Tab focus but are always dismissible via Escape and a Close button; focus returns to the trigger on close. No unintended traps found. |
| **2.1.4 Character Key Shortcuts** (A) | Not Applicable | The product implements no single-character key shortcuts. |
| **2.2.1 Timing Adjustable** (A) | Not Applicable | No time limits are imposed on user actions. |
| **2.2.2 Pause, Stop, Hide** (A) | Supports | No auto-updating/moving/blinking content beyond loading spinners; `prefers-reduced-motion` is honored globally to neutralize animation. |
| **2.3.1 Three Flashes or Below Threshold** (A) | Supports | No content flashes more than three times per second. |
| **2.4.1 Bypass Blocks** (A) | Supports | A "Skip to main content" link targets `#main-content`, present on every layout/shell (including auth and standalone status pages); ARIA landmarks are provided. |
| **2.4.2 Page Titled** (A) | Supports | Every route sets a page-specific, descriptive document title via Next.js route `metadata`, rendered through a `"%s · JSWP Online"` template. |
| **2.4.3 Focus Order** (A) | Supports | Focus order follows a logical sequence. Dialogs move focus into the dialog on open and restore it to the trigger on close via a shared dialog-a11y hook. |
| **2.4.4 Link Purpose (In Context)** (A) | Supports | Link text (with programmatic context) describes destination; icon links carry `aria-label`. |
| **2.5.1 Pointer Gestures** (A) | Supports | The only path-based gesture (drag to reorder) has an equivalent single-pointer alternative (up/down buttons). No multipoint gestures are required. |
| **2.5.2 Pointer Cancellation** (A) | Supports | Activation occurs on the up-event; no down-event-only actions were found. |
| **2.5.3 Label in Name** (A) | Supports | Accessible names of controls contain their visible label text. |
| **2.5.4 Motion Actuation** (A) | Not Applicable | No functionality is operated by device or user motion. |
| **3.1.1 Language of Page** (A) | Supports | The root document sets `lang="en"`. |
| **3.2.1 On Focus** (A) | Supports | Receiving focus does not trigger a change of context. |
| **3.2.2 On Input** (A) | Supports | Changing a form control value does not automatically cause a change of context; submissions are explicit. |
| **3.2.6 Consistent Help** (A) *(new in 2.2)* | Supports | Where help/contact affordances appear (e.g. auth pages), they are presented consistently. No per-page help mechanism varies in relative order. |
| **3.3.1 Error Identification** (A) | Supports | Validation errors are identified in text, linked to fields via `aria-invalid` + `aria-describedby`. |
| **3.3.2 Labels or Instructions** (A) | Supports | Inputs provide labels/instructions. The autosave field component now supplies a persistent accessible name (an explicit label or a placeholder-derived `aria-label`). |
| **3.3.7 Redundant Entry** (A) *(new in 2.2)* | Supports | Previously entered information is not required to be re-entered in the same process; password confirmation is the permitted exception. |
| **4.1.1 Parsing** (A) | Not Applicable | Removed from WCAG 2.2. Retained here for completeness; no conformance claim is required. |
| **4.1.2 Name, Role, Value** (A) | Supports | Custom controls expose appropriate roles/states (e.g. `aria-pressed` on toggles, `aria-expanded`/`aria-haspopup` on menus, `aria-current` on active nav, dialog roles). Remaining dashboard menu keyboard patterns are enhancement-level, not defects. |

### Table 2: Success Criteria, Level AA

| Criteria | Conformance Level | Remarks and Explanations |
|---|---|---|
| **1.2.4 Captions (Live)** (AA) | Not Applicable | No live synchronized media. |
| **1.2.5 Audio Description (Prerecorded)** (AA) | Not Applicable | No pre-recorded synchronized media. |
| **1.3.4 Orientation** (AA) | Supports | Layout is responsive; no orientation lock. |
| **1.3.5 Identify Input Purpose** (AA) | Supports | `autocomplete` tokens are set on email, name, and password fields. |
| **1.4.3 Contrast (Minimum)** (AA) | Supports | A comprehensive sweep darkened low-contrast content text (`text-gray-400/300` on light backgrounds) to `text-gray-500/600` to meet 4.5:1 (large text 3:1) across the application; exempt cases (disabled controls, light-on-dark text) were preserved. JSWP role colors meet AA on white. Contrast was confirmed via Lighthouse/axe on the audited surfaces (100/100), which surfaced and drove fixes for muted text on tinted backgrounds. |
| **1.4.4 Resize Text** (AA) | Supports | Rem-based type scale (min 16px floors); text scales with browser zoom without loss of content. |
| **1.4.5 Images of Text** (AA) | Supports | Text is rendered as text; images are limited to logos/branding. |
| **1.4.10 Reflow** (AA) | Supports | The application reflows to a 320px-wide viewport (mobile drawers, no fixed-width horizontal scroll). Wide teacher-authored tables inside rendered rich source text now scroll within their own container rather than forcing horizontal page scroll. |
| **1.4.11 Non-text Contrast** (AA) | Supports | Focus indicators render a visible ring (a missing ring-width utility was corrected across input components); idle form-control borders were darkened to `border-gray-400`/`border-stone-400` to meet 3:1; low-contrast icon affordances were darkened; `forced-colors` mode is handled. |
| **1.4.12 Text Spacing** (AA) | Supports | No fixed line-height/letter-spacing that would clip under user text-spacing overrides. |
| **1.4.13 Content on Hover or Focus** (AA) | Supports | Custom hover/focus content (selection popover) is dismissible (Escape), hoverable, and persistent. Native `title` tooltips are user-agent controlled. |
| **2.4.5 Multiple Ways** (AA) | Supports | Multiple navigation paths exist (persistent nav/sidebars, in-context links, and breadcrumb trails within nested admin routes). |
| **2.4.6 Headings and Labels** (AA) | Supports | Headings and labels are descriptive. |
| **2.4.7 Focus Visible** (AA) | Supports | A visible focus indicator is present on interactive elements; the borderless autosave field and previously ring-less inputs were corrected. No global `outline:none` without replacement. |
| **2.4.11 Focus Not Obscured (Minimum)** (AA) *(new in 2.2)* | Supports | A `scroll-margin-top` rule keeps focused controls in the main region clear of the ~64px sticky headers. |
| **2.5.7 Dragging Movements** (AA) *(new in 2.2)* | Supports | The candidate-reorder drag interaction provides an equivalent single-pointer alternative (up/down buttons) in addition to keyboard support. |
| **2.5.8 Target Size (Minimum)** (AA) *(new in 2.2)* | Supports | Icon-only controls — delete/move/reorder buttons, inline row actions, close/dismiss buttons, password toggles, and chevron navigation links — were enlarged to a ≥24×24px hit area across the application. |
| **3.1.2 Language of Parts** (AA) | Supports | Content is presented in the page language; no mixed-language passages requiring `lang` markup were identified in application chrome. |
| **3.2.3 Consistent Navigation** (AA) | Supports | Navigation is consistent in relative order across each console. |
| **3.2.4 Consistent Identification** (AA) | Supports | Components with the same function are identified consistently. |
| **3.3.3 Error Suggestion** (AA) | Supports | Validation messages describe the problem and, where known, suggest corrections. |
| **3.3.4 Error Prevention (Legal, Financial, Data)** (AA) | Supports | Destructive actions (deletions) use confirmation dialogs, including type-to-confirm for high-impact deletions. No legal/financial transactions. |
| **3.3.8 Accessible Authentication (Minimum)** (AA) *(new in 2.2)* | Supports | Authentication does not require a cognitive function test; password fields permit paste and browser autofill (`autocomplete`). |
| **4.1.3 Status Messages** (AA) | Supports | Status messages are exposed via live regions: toast notifications (`aria-live="assertive"`), autosave/grade "Saved" indicators (`aria-live="polite"`), loading states (`role="status"`), and error boundaries (`role="alert"`). |

### Table 3: Success Criteria, Level AAA

Level AAA was **not a conformance target** and criteria were **not formally
evaluated**. Some AAA provisions are nonetheless partially met as a by-product of
the work above (e.g. 2.4.13 Focus Appearance via thick focus rings; 1.4.6 Enhanced
Contrast for the dark role colors on white). A dedicated AAA evaluation would be
required to make any AAA claim.

---

## Legal Disclaimer

This report is a **self-assessment prepared by the product team** and is provided
for informational purposes. It reflects the state of the `v2` rebuild as of the
report date and is **subject to change**. Conformance determinations combine
static code review with automated (Lighthouse / axe-core) and keyboard/pointer
validation of the running application; **manual assistive-technology testing
(screen readers, screen magnification / 400% zoom) and testing with users with
disabilities are recommended** as ongoing validation to further confirm the
claims herein. "VPAT" is a registered trademark of the Information Technology
Industry Council (ITI).

## Remediation Backlog

The code-level defects identified in the audit have been remediated:

- ✅ **1.4.1** — Non-color per-kind cue (underline line styles) added to text-annotation highlights.
- ✅ **2.4.2** — Page-specific `metadata` titles added to every route.
- ✅ **1.4.3 / 1.4.11 / 2.5.8** — Contrast, form-control-border non-text-contrast, and target-size passes completed across the application.
- ✅ **1.4.10** — Wide rich-source tables scroll within their container.

**Validation performed:** Lighthouse/axe audits at 100/100 across the end-to-end
student writing flow, the teacher Assignment Builder, and the teacher
Grade-Writing page; keyboard annotation create/edit, drag/▲▼ reorder, and the
grade-format `aria-pressed` toggle exercised end-to-end. Seven defects found and
fixed.

**Recommended ongoing validation:**

- Manual assistive-technology testing — screen readers (NVDA/JAWS/VoiceOver),
  voice control, 400% zoom/reflow, and testing with users with disabilities.
- Rubric-scoring panel — the rubric selection control (`✓` marker + focus-within
  ring) is validated at the code level; exercise it live on a rubric-bearing
  assignment (rubric editing locks after publish).
