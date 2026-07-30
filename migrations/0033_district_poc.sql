-- 0033_district_poc.sql
-- Districts now carry two required Points of Contact (POCs), each a real
-- district_admin login account. This migration adds:
--   * user_profiles.phone      — contact number for POCs (and any user)
--   * user_profiles.invited_at — when the set-password invite was last sent
--   * districts.primary_poc_id / secondary_poc_id — FKs to the two POC accounts
--
-- The FK columns are nullable at the DB level to break the districts <->
-- user_profiles circular dependency: the create-district action inserts the
-- district first, then the two POC user_profiles (which need district_id), then
-- backfills these FKs. "Both POCs required" is enforced in the application layer
-- (lib/actions/districts.ts), not by a NOT NULL constraint. ON DELETE SET NULL
-- so deleting a POC account never blocks district deletion or orphans the row.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS primary_poc_id   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secondary_poc_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.phone IS 'Contact phone number (free-form, app-validated). Required for district POCs.';
COMMENT ON COLUMN user_profiles.invited_at IS 'Timestamp the set-password invite email was last sent; NULL = never invited.';
COMMENT ON COLUMN districts.primary_poc_id IS 'Primary point-of-contact district_admin account. Nullable at DB level; required by the create-district action.';
COMMENT ON COLUMN districts.secondary_poc_id IS 'Secondary point-of-contact district_admin account. Nullable at DB level; required by the create-district action.';
