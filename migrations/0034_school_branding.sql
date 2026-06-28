-- 0034_school_branding.sql
-- Schools gain their own branding (logo + primary/secondary colours), mirroring
-- districts (see 0001). All optional; same format CHECKs as districts so the
-- app and DB agree on what a valid hex colour / logo URL looks like.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS logo_url        TEXT
    CHECK (logo_url IS NULL OR logo_url ~ '^https?://'),
  ADD COLUMN IF NOT EXISTS primary_color   VARCHAR(7)
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7)
    CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN schools.logo_url IS 'School logo URL (http/https). Optional; falls back to a district/role icon.';
COMMENT ON COLUMN schools.primary_color IS 'School primary brand colour (#RRGGBB). Optional.';
COMMENT ON COLUMN schools.secondary_color IS 'School secondary brand colour (#RRGGBB). Optional.';
