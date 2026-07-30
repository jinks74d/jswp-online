-- ---------------------------------------------------------------------------
-- 0021_user_profiles_nullable_district.sql
--
-- Super admins are the developers/owners of JSWP Online (Louis Educational
-- Concepts) and belong to no district. The original schema (0001) already
-- carried CHECK (role = 'super_admin' OR district_id IS NOT NULL), signalling
-- that super admins were meant to have a NULL district — but the column was
-- left NOT NULL, contradicting that intent. The seed worked around it by
-- assigning the demo district to the super_admin row.
--
-- This migration loosens the column to match the original intent. The CHECK
-- constraint is untouched and continues to require a district for every
-- non-super-admin role.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE user_profiles ALTER COLUMN district_id DROP NOT NULL;

-- Make existing super_admin row(s) truly districtless so reality matches the
-- new rule. Non-super-admins are unaffected (and still constrained by CHECK).
UPDATE user_profiles SET district_id = NULL WHERE role = 'super_admin';

COMMIT;
