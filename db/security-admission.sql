-- Staged migration: apply before traffic promotion. Only product-owned schema.
CREATE TABLE IF NOT EXISTS pulse_security_rate_limits(key text PRIMARY KEY,hits integer NOT NULL CHECK(hits>0),window_started_at timestamptz NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS pulse_security_rate_limits_expiry ON pulse_security_rate_limits(expires_at);
-- Periodically delete expired rows using existing maintenance operations.
-- SECURITY_TRUSTED_LB_IPS must contain exact LB addresses; restrict direct ingress first.
