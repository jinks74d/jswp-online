-- 0044_tchart_commentary_sentence.sql
-- The printed Expository T-Chart (2024 Expository Guide p.79) has SIX regions,
-- not five: PROMPT / TOPIC SENTENCE / REVISED TOPIC SENTENCE / CDs | CMs /
-- COMMENTARY SENTENCE / CONCLUDING SENTENCE. The app shipped the T-Chart
-- without the full-width COMMENTARY SENTENCE line, so the student had nowhere
-- to Pick-n-Stitch unused commentary words into the paragraph's CM sentence.
--
-- This is the T-Chart-level commentary sentence, and it is distinct from
-- commentary_items.text (the per-CD green "cloud" ovals, which hold the
-- brainstormed commentary the student stitches FROM). It parallels
-- revised_topic_sentence: written on the T-Chart, polished later into
-- shaping_chunk_outputs.cm_sentences on the Shaping Sheet.
--
-- Nullable — every existing t_chart row simply has no commentary sentence yet,
-- and a 3+:0 summary never gets one (a summary has zero commentary).

ALTER TABLE t_charts
  ADD COLUMN IF NOT EXISTS commentary_sentence TEXT;

COMMENT ON COLUMN t_charts.commentary_sentence IS
  'The T-Chart''s full-width COMMENTARY SENTENCE (Expository guide p.79), Pick-n-Stitched from unused commentary words/phrases. Distinct from commentary_items.text (the per-CD CM clouds). NULL = not written yet; always NULL at 3+:0.';
