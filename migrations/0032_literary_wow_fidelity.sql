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
