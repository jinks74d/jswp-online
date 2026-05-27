-- ---------------------------------------------------------------------------
-- 0023_annotation_kind_main_idea.sql
--
-- Adds a 'main_idea' annotation kind. The JSWP "Finding the Main Idea" step
-- (2024 Expository guide pp.52-53) has students underline the source's main
-- idea / thesis in black before gathering supporting CDs. The annotation
-- model already supports CD (red), CM (green), transition, and note; this
-- adds the main-idea anchor. The student's paraphrase lives in the existing
-- text_annotations.note field — no new column.
--
-- NOTE: ALTER TYPE ... ADD VALUE is deliberately NOT wrapped in BEGIN/COMMIT.
-- Enum value additions have historically been transaction-restricted; keeping
-- it bare (with IF NOT EXISTS for idempotency) is the portable form. PG17 on
-- the v2 project would tolerate a transaction, but the new value still can't
-- be USED until the adding statement commits — irrelevant here, nothing uses
-- it in this migration.
-- ---------------------------------------------------------------------------

ALTER TYPE jswp_annotation_kind ADD VALUE IF NOT EXISTS 'main_idea';
