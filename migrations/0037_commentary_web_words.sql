-- 0037_commentary_web_words.sql
-- Each commentary "cloud" on the Expository T-Chart holds the commentary
-- sentence in the oval and up to 4 brainstormed supporting words on the rays
-- around it (design base: T-Chart Worksheet.html — 1 in the oval, 4 outside).
-- Stored as a small fixed-size text array on the commentary item, mirroring
-- the existing TEXT[] scaffolds (shaping_sheets.rules_applied / revision_moves).
-- Nullable; NULL / empty array = no web brainstormed yet. Index 0-3 map to the
-- four ray positions (top-left, top-right, bottom-left, bottom-right).

ALTER TABLE commentary_items
  ADD COLUMN IF NOT EXISTS web_words TEXT[];

COMMENT ON COLUMN commentary_items.web_words IS
  'Up to 4 brainstormed supporting words on the rays of the commentary "cloud" (Expository T-Chart web). Index 0-3 = ray positions. NULL/empty = none.';
