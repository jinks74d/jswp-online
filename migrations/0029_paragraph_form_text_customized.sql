-- 0029_paragraph_form_text_customized.sql
-- ─────────────────────────────────────────────────────────────────────
-- Auto-sync-until-customized for the Paragraph Form's final_text.
--
-- Problem this fixes: final_text was seeded ONCE from the composed
-- paragraph while empty, then never resynced. A student who visited the
-- Paragraph Form, then went back and added/edited sentences on the
-- Shaping Sheet, ended up with a stale final_text (the classic "shows
-- only the first and last CD" symptom) — and final_text is what gets
-- submitted and graded.
--
-- New policy: when final_text_customized = false (default), final_text is
-- regenerated from the composed paragraph (TS + per-chunk CD/CM + CS) on
-- each Paragraph Form visit, so it never goes stale. The flag flips to
-- true the moment the student hand-edits the "fine-tune wording" box,
-- after which their wording is preserved. See
-- lib/actions/paragraph-form.ts → syncParagraphForms / updateFinalText.
ALTER TABLE paragraph_forms
  ADD COLUMN IF NOT EXISTS final_text_customized boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN paragraph_forms.final_text_customized IS
  'False = final_text auto-syncs from the composed paragraph on each Paragraph Form visit (never goes stale when upstream sentences change). True = student hand-edited the fine-tune box; preserve their wording. Migration 0029.';
