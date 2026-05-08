-- ============================================================================
-- JSWP Online — Signup Requests + Approval RPCs (0006)
-- ============================================================================
-- Pending-account queue for self-signup. /signup writes a row here; an
-- admin approves (creating user_profiles) or denies. Two RPCs wrap the
-- atomic state transitions so concurrent admin actions can't double-apply.
--
-- Service-role-only INSERT (no policy for authenticated). UPDATE/DELETE are
-- admin-scope-only via RLS. SELECT is owner-self OR admin-in-scope.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

CREATE TYPE jswp_signup_status AS ENUM ('pending', 'approved', 'denied');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE signup_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One signup request per auth user. CASCADE: deleting the auth user
  -- (e.g. cleaning up a denied account) drops the request with it.
  auth_user_id          UUID NOT NULL UNIQUE
                          REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Denormalized at signup so admin queries don't round-trip auth.users.
  email                 VARCHAR(255) NOT NULL,
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,

  -- Defaults to 'teacher'. Self-signup never grants super_admin.
  requested_role        jswp_role NOT NULL DEFAULT 'teacher',

  -- Auto-set from middleware x-jswp-district-id at signup if subdomain
  -- resolved. NULL on apex-domain signups; only super_admin sees those.
  requested_district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  requested_school_id   UUID REFERENCES schools(id)   ON DELETE SET NULL,

  -- Optional context the user provides ("I teach 9th grade English at...")
  message               TEXT,

  status                jswp_signup_status NOT NULL DEFAULT 'pending',

  -- Decision metadata. SET NULL preserves history if the deciding admin
  -- is later removed.
  decided_by            UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  decided_at            TIMESTAMPTZ,
  decision_notes        TEXT,            -- admin-only context
  denial_reason         TEXT,            -- shown to the user on denial

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Defense in depth — even if the form is bypassed, no super_admin
  -- via self-signup.
  CHECK (requested_role IN ('teacher', 'school_admin', 'district_admin'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Admin queue lookups: "pending requests in my district"
CREATE INDEX idx_signup_requests_status_district
  ON signup_requests(status, requested_district_id);

-- Oldest-first review queue
CREATE INDEX idx_signup_requests_created
  ON signup_requests(created_at DESC);

-- (auth_user_id has an implicit unique index from the UNIQUE constraint.)

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

-- The user can read their own request (status display on /pending).
CREATE POLICY signup_requests_read_own ON signup_requests
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Admins read in scope. Apex-domain signups (NULL district_id) are visible
-- to super_admin only.
CREATE POLICY signup_requests_read_admin ON signup_requests
  FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'super_admin'
    OR (
      requested_district_id IS NOT NULL
      AND auth_user_is_admin_for_district(requested_district_id)
    )
    OR (
      requested_school_id IS NOT NULL
      AND auth_user_is_admin_for_school(requested_school_id)
    )
  );

-- Admins update in scope. The RPCs enforce the actual state-machine rules
-- (only pending → approved/denied); RLS just gates "can you touch this row."
CREATE POLICY signup_requests_update_admin ON signup_requests
  FOR UPDATE TO authenticated
  USING (
    auth_user_role() = 'super_admin'
    OR (
      requested_district_id IS NOT NULL
      AND auth_user_is_admin_for_district(requested_district_id)
    )
    OR (
      requested_school_id IS NOT NULL
      AND auth_user_is_admin_for_school(requested_school_id)
    )
  )
  WITH CHECK (
    auth_user_role() = 'super_admin'
    OR (
      requested_district_id IS NOT NULL
      AND auth_user_is_admin_for_district(requested_district_id)
    )
    OR (
      requested_school_id IS NOT NULL
      AND auth_user_is_admin_for_school(requested_school_id)
    )
  );

-- "Permanently delete denied request" cleanup. Only denied rows are
-- deletable via UI; pending and approved must be kept.
CREATE POLICY signup_requests_delete_admin ON signup_requests
  FOR DELETE TO authenticated
  USING (
    status = 'denied'
    AND (
      auth_user_role() = 'super_admin'
      OR (
        requested_district_id IS NOT NULL
        AND auth_user_is_admin_for_district(requested_district_id)
      )
      OR (
        requested_school_id IS NOT NULL
        AND auth_user_is_admin_for_school(requested_school_id)
      )
    )
  );

-- INSERT: no policy for authenticated. Service role (signUpAction's admin
-- client) is the only writer of new rows.

-- ---------------------------------------------------------------------------
-- RPCs — atomic state transitions
-- ---------------------------------------------------------------------------

-- Approve: locks the signup_request row, validates pending, inserts
-- user_profiles, marks request approved. SELECT FOR UPDATE blocks
-- concurrent approves; the second caller raises after the first commits.
CREATE OR REPLACE FUNCTION approve_signup_request(
  p_signup_request_id UUID,
  p_role              jswp_role,
  p_district_id       UUID,
  p_school_id         UUID,
  p_decided_by        UUID,
  p_decision_notes    TEXT
)
RETURNS user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sr           signup_requests;
  new_profile  user_profiles;
BEGIN
  SELECT * INTO sr
    FROM signup_requests
    WHERE id = p_signup_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup request not found' USING ERRCODE = 'P0002';
  END IF;

  IF sr.status <> 'pending' THEN
    RAISE EXCEPTION 'Signup request is not pending (status: %)', sr.status
      USING ERRCODE = 'P0001';
  END IF;

  -- INSERT enforces user_profiles CHECK constraints and FK validity.
  -- Email-uniqueness violations propagate as 23505.
  INSERT INTO user_profiles (
    id, district_id, school_id, role, email, first_name, last_name
  ) VALUES (
    sr.auth_user_id, p_district_id, p_school_id, p_role,
    sr.email, sr.first_name, sr.last_name
  )
  RETURNING * INTO new_profile;

  UPDATE signup_requests SET
    status         = 'approved',
    decided_by     = p_decided_by,
    decided_at     = NOW(),
    decision_notes = p_decision_notes,
    updated_at     = NOW()
  WHERE id = p_signup_request_id;

  RETURN new_profile;
END;
$$;

-- Deny: same lock-and-validate pattern, just marks the row denied.
CREATE OR REPLACE FUNCTION deny_signup_request(
  p_signup_request_id UUID,
  p_decided_by        UUID,
  p_denial_reason     TEXT,
  p_decision_notes    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sr signup_requests;
BEGIN
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

  IF sr.status <> 'pending' THEN
    RAISE EXCEPTION 'Signup request is not pending (status: %)', sr.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE signup_requests SET
    status         = 'denied',
    decided_by     = p_decided_by,
    decided_at     = NOW(),
    denial_reason  = p_denial_reason,
    decision_notes = p_decision_notes,
    updated_at     = NOW()
  WHERE id = p_signup_request_id;
END;
$$;

-- RPCs are SECURITY DEFINER so they need explicit EXECUTE grants for
-- the authenticated role to call them via supabase.rpc(...).
GRANT EXECUTE ON FUNCTION approve_signup_request(UUID, jswp_role, UUID, UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION deny_signup_request(UUID, UUID, TEXT, TEXT)
  TO authenticated;

COMMIT;
