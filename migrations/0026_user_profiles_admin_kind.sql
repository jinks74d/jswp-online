-- ---------------------------------------------------------------------------
-- 0026_user_profiles_admin_kind.sql
--
-- School admins come in three flavors that share the same authorization scope
-- (school_admin) but land on different dashboards: Administrator, Counselor,
-- and Other. Rather than splitting jswp_role (which would ripple through every
-- RLS policy and requireRole call), this adds a discriminator column. The role
-- stays 'school_admin'; admin_kind only drives the post-login destination.
--
-- admin_kind is NULL for every non-school-admin role (enforced by CHECK).
-- Existing school admins are backfilled to 'administrator' so they keep a
-- working dashboard.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE TYPE jswp_admin_kind AS ENUM ('administrator', 'counselor', 'other');

ALTER TABLE user_profiles ADD COLUMN admin_kind jswp_admin_kind;

-- The kind only ever applies to school admins.
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_admin_kind_scope
  CHECK (admin_kind IS NULL OR role = 'school_admin');

-- Give existing school admins an explicit kind so they route somewhere.
UPDATE user_profiles
  SET admin_kind = 'administrator'
  WHERE role = 'school_admin' AND admin_kind IS NULL;

COMMIT;
