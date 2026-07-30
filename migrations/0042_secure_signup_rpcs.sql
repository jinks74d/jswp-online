-- ============================================================================
-- JSWP Online — Secure the signup approval RPCs (0042)
-- ============================================================================
-- SECURITY FIX. As shipped in 0006, approve_signup_request and
-- deny_signup_request were SECURITY DEFINER, GRANTed to `authenticated`, and
-- performed NO authorization checks of their own. Because SECURITY DEFINER
-- bypasses RLS inside the function body, the RLS-scoped client the action
-- layer used was irrelevant — the only gate was requireRole() in the server
-- action, and a server action is not the only way to reach an RPC.
--
-- Exploit (reachable by anyone who can load the public /signup form):
--   1. Register, confirm the email → `authenticated`, no profile, on /pending.
--   2. Read your own request id (signup_requests_read_own permits this).
--   3. rpc('approve_signup_request', { p_role: 'super_admin', ... })
--   The INSERT into user_profiles lands before the UPDATE that sets
--   decided_by, so the self-referential FK resolves and the txn commits.
--   Result: full super_admin — every district, every student record.
--
-- This migration replaces both functions with authorizing versions.
--
-- Changes
-- -------
--   1. Caller must be an active admin (super / district / school).
--   2. Caller must have scope over the REQUEST row — mirrors the
--      signup_requests_read_admin policy, which the definer context skipped.
--   3. Caller must have scope over the GRANT TARGET (district / school). This
--      was missing entirely: an in-scope admin could provision an account
--      into any other district.
--   4. Role ceiling (locked with the product owner):
--        super_admin    → teacher | school_admin | district_admin, any district
--        district_admin → teacher | school_admin | district_admin,
--                         ONLY within their own district
--        school_admin   → teacher | school_admin, ONLY within their own school
--      No caller may mint a super_admin here; super admins are provisioned
--      through lib/actions/super-admins.ts.
--   5. Referential sanity: p_school_id must belong to p_district_id. 0006
--      let you attach a school from a different district.
--   6. p_decided_by is REMOVED from both signatures. It was caller-supplied,
--      so the decision trail was spoofable; the actor is now auth.uid().
--
-- Signature change means DROP + CREATE (CREATE OR REPLACE cannot alter the
-- parameter list) and a re-GRANT. lib/actions/signups.ts is updated in the
-- same commit to stop passing p_decided_by.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Drop the vulnerable versions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS approve_signup_request(UUID, jswp_role, UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS deny_signup_request(UUID, UUID, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- Shared guard: may the calling user decide THIS request?
-- ---------------------------------------------------------------------------
-- Mirrors signup_requests_read_admin. Kept as its own helper so approve and
-- deny cannot drift apart (the 14.4 anti-pattern: policies that re-implement
-- scoping inline with subtle differences).

CREATE OR REPLACE FUNCTION auth_user_can_decide_signup_request(sr_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM signup_requests sr
    WHERE sr.id = sr_id
      AND (
        auth_user_role() = 'super_admin'
        OR (
          sr.requested_district_id IS NOT NULL
          AND auth_user_is_admin_for_district(sr.requested_district_id)
        )
        OR (
          sr.requested_school_id IS NOT NULL
          AND auth_user_is_admin_for_school(sr.requested_school_id)
        )
      )
  );
$$;

COMMENT ON FUNCTION auth_user_can_decide_signup_request(UUID) IS
  'True if the calling user is an admin with scope over this signup request. '
  'Mirrors the signup_requests_read_admin RLS policy for use inside '
  'SECURITY DEFINER bodies, where that policy does not apply.';

-- ---------------------------------------------------------------------------
-- Approve
-- ---------------------------------------------------------------------------

CREATE FUNCTION approve_signup_request(
  p_signup_request_id UUID,
  p_role              jswp_role,
  p_district_id       UUID,
  p_school_id         UUID,
  p_decision_notes    TEXT
)
RETURNS user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sr                signup_requests;
  new_profile       user_profiles;
  caller_role       jswp_role  := auth_user_role();
  caller_district   UUID       := auth_user_district_id();
  caller_school     UUID       := auth_user_school_id();
  target_school_dist UUID;
BEGIN
  -- 1. Caller must be an admin at all. auth_user_role() returns NULL for a
  --    profileless user (exactly the pending-signup attacker above).
  IF caller_role IS NULL
     OR caller_role NOT IN ('super_admin', 'district_admin', 'school_admin')
  THEN
    RAISE EXCEPTION 'Not authorized to approve signup requests'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Never mint a super_admin through the self-signup queue.
  IF p_role NOT IN ('teacher', 'school_admin', 'district_admin') THEN
    RAISE EXCEPTION 'Role % cannot be granted through signup approval', p_role
      USING ERRCODE = '42501';
  END IF;

  -- 3. Shape checks mirroring the user_profiles CHECK constraints, so we fail
  --    with a clear 42501/22023 rather than an opaque 23514 downstream.
  IF p_district_id IS NULL THEN
    RAISE EXCEPTION 'A district is required for role %', p_role
      USING ERRCODE = '22023';
  END IF;

  IF p_role IN ('teacher', 'school_admin') AND p_school_id IS NULL THEN
    RAISE EXCEPTION 'A school is required for role %', p_role
      USING ERRCODE = '22023';
  END IF;

  -- 4. Referential sanity: the school must live in the target district.
  IF p_school_id IS NOT NULL THEN
    SELECT district_id INTO target_school_dist
      FROM schools WHERE id = p_school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'School not found' USING ERRCODE = 'P0002';
    END IF;

    IF target_school_dist <> p_district_id THEN
      RAISE EXCEPTION 'That school does not belong to the selected district'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5. Lock the request and validate the state machine.
  SELECT * INTO sr
    FROM signup_requests
    WHERE id = p_signup_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup request not found' USING ERRCODE = 'P0002';
  END IF;

  -- 6. Scope over the REQUEST. Deliberately after the lock so concurrent
  --    callers serialize identically regardless of authorization outcome.
  IF NOT auth_user_can_decide_signup_request(p_signup_request_id) THEN
    RAISE EXCEPTION 'Signup request is outside your scope'
      USING ERRCODE = '42501';
  END IF;

  IF sr.status <> 'pending' THEN
    RAISE EXCEPTION 'Signup request is not pending (status: %)', sr.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Scope over the GRANT TARGET + role ceiling.
  --    super_admin falls through unrestricted.
  IF caller_role = 'district_admin' THEN
    -- May grant any of the three roles, but only inside their own district.
    IF caller_district IS NULL OR p_district_id <> caller_district THEN
      RAISE EXCEPTION 'You can only approve accounts in your own district'
        USING ERRCODE = '42501';
    END IF;

  ELSIF caller_role = 'school_admin' THEN
    -- May not grant above their own level.
    IF p_role = 'district_admin' THEN
      RAISE EXCEPTION 'You cannot grant district administrator access'
        USING ERRCODE = '42501';
    END IF;
    -- ...and only into their own school.
    IF caller_school IS NULL OR p_school_id IS DISTINCT FROM caller_school THEN
      RAISE EXCEPTION 'You can only approve accounts at your own school'
        USING ERRCODE = '42501';
    END IF;
    IF caller_district IS NULL OR p_district_id <> caller_district THEN
      RAISE EXCEPTION 'You can only approve accounts in your own district'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 8. Apply. INSERT still enforces the user_profiles CHECKs and FK validity;
  --    email-uniqueness violations propagate as 23505.
  INSERT INTO user_profiles (
    id, district_id, school_id, role, email, first_name, last_name
  ) VALUES (
    sr.auth_user_id, p_district_id, p_school_id, p_role,
    sr.email, sr.first_name, sr.last_name
  )
  RETURNING * INTO new_profile;

  UPDATE signup_requests SET
    status         = 'approved',
    decided_by     = auth.uid(),   -- never a caller-supplied actor id
    decided_at     = NOW(),
    decision_notes = p_decision_notes,
    updated_at     = NOW()
  WHERE id = p_signup_request_id;

  RETURN new_profile;
END;
$$;

-- ---------------------------------------------------------------------------
-- Deny
-- ---------------------------------------------------------------------------

CREATE FUNCTION deny_signup_request(
  p_signup_request_id UUID,
  p_denial_reason     TEXT,
  p_decision_notes    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sr          signup_requests;
  caller_role jswp_role := auth_user_role();
BEGIN
  IF caller_role IS NULL
     OR caller_role NOT IN ('super_admin', 'district_admin', 'school_admin')
  THEN
    RAISE EXCEPTION 'Not authorized to deny signup requests'
      USING ERRCODE = '42501';
  END IF;

  IF p_denial_reason IS NULL OR length(trim(p_denial_reason)) = 0 THEN
    RAISE EXCEPTION 'Denial reason is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO sr
    FROM signup_requests
    WHERE id = p_signup_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup request not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT auth_user_can_decide_signup_request(p_signup_request_id) THEN
    RAISE EXCEPTION 'Signup request is outside your scope'
      USING ERRCODE = '42501';
  END IF;

  IF sr.status <> 'pending' THEN
    RAISE EXCEPTION 'Signup request is not pending (status: %)', sr.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE signup_requests SET
    status         = 'denied',
    decided_by     = auth.uid(),
    decided_at     = NOW(),
    denial_reason  = p_denial_reason,
    decision_notes = p_decision_notes,
    updated_at     = NOW()
  WHERE id = p_signup_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, so an explicit GRANT to
-- `authenticated` is not what opens these up — the REVOKE is what closes the
-- anon/public surface. Both functions now authorize internally regardless.
--
-- Verified against the live 0006 state before this migration: the ACL read
--   =X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- The leading `=X/` is PUBLIC — so the vulnerable RPCs were reachable with
-- the anon key alone, no account required.
--
-- Two REVOKEs are needed, not one. Supabase ships ALTER DEFAULT PRIVILEGES on
-- schema public that auto-grants EXECUTE to anon + authenticated for every
-- newly created function, and REVOKE ... FROM PUBLIC does NOT remove that
-- explicit per-role grant. Dropping only PUBLIC leaves `anon=X/postgres`
-- behind. Confirm with:
--   SELECT proname, array_to_string(proacl,' | ') FROM pg_proc
--    WHERE proname = 'approve_signup_request';
-- Expected after this migration: postgres | authenticated | service_role.

REVOKE ALL ON FUNCTION approve_signup_request(UUID, jswp_role, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION deny_signup_request(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_user_can_decide_signup_request(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION approve_signup_request(UUID, jswp_role, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION deny_signup_request(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION auth_user_can_decide_signup_request(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION approve_signup_request(UUID, jswp_role, UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION deny_signup_request(UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_can_decide_signup_request(UUID)
  TO authenticated;

COMMIT;
