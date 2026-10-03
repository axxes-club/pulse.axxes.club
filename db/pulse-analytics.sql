-- Run ONLY on the isolated analytics database, not on the shared identity DB.
BEGIN;
CREATE TABLE IF NOT EXISTS pulse_events (
 site_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('production','development')),
 event_id text NOT NULL,
 name text NOT NULL,
 occurred_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 visitor_key text NOT NULL,
 session_key text NOT NULL,
 path text NOT NULL DEFAULT '/',
 source text NOT NULL DEFAULT 'Direct',
 country text NOT NULL DEFAULT 'Unknown',
 device text NOT NULL DEFAULT 'Unknown',
 properties jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(site_id,event_id)
);
CREATE INDEX IF NOT EXISTS pulse_events_report_idx ON pulse_events(tenant_id,site_id,environment,occurred_at);
CREATE TABLE IF NOT EXISTS pulse_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
COMMIT;
