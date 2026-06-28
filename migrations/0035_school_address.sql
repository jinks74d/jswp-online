-- 0035_school_address.sql
-- Schools gain a free-text street address, surfaced on the district-admin
-- Schools dashboard cards and editable via the school form. Optional; existing
-- schools keep NULL until edited. No CHECK — addresses are unstructured.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN schools.address IS 'School street address (free text). Optional; shown on the district-admin Schools dashboard.';
