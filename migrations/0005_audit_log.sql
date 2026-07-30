-- ============================================================================
-- JSWP Online — Audit Log (0005)
-- ============================================================================
-- Append-only log of privileged admin actions. The first writer is the
-- roster import; future tickets (assignment publish, grade lock, district
-- create) will write here too. Service role only for INSERT — the table is
-- never written to from a logged-in user's session, only from server actions
-- that explicitly use the admin client.
-- ============================================================================

BEGIN;

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  action       VARCHAR(100) NOT NULL,
  target_scope JSONB,
  metadata     JSONB,
  district_id  UUID REFERENCES districts(id) ON DELETE CASCADE,
  school_id    UUID REFERENCES schools(id)   ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor    ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action   ON audit_log(action);
CREATE INDEX idx_audit_log_district ON audit_log(district_id);
CREATE INDEX idx_audit_log_created  ON audit_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — read-only for end users, no INSERT/UPDATE/DELETE policies so the
-- service role is the only writer.
-- ---------------------------------------------------------------------------

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Actor can see their own log entries.
CREATE POLICY audit_log_read_self ON audit_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- District / school / super admins can see entries scoped to their district.
-- auth_user_is_admin_for_district returns TRUE for super_admin in any
-- district and for district_admin in their own district.
CREATE POLICY audit_log_read_admin_in_scope ON audit_log
  FOR SELECT TO authenticated
  USING (
    district_id IS NOT NULL
    AND auth_user_is_admin_for_district(district_id)
  );

-- No INSERT / UPDATE / DELETE policies for authenticated. The service role
-- (admin client) bypasses RLS and is the only allowed writer.

COMMIT;
