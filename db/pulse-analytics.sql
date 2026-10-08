-- Run ONLY on the isolated analytics database, not on the shared identity DB.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.pulse_events') AND relkind='r') THEN
  ALTER TABLE pulse_events RENAME TO pulse_events_bootstrap;
  ALTER INDEX IF EXISTS pulse_events_pkey RENAME TO pulse_events_bootstrap_pkey;
  ALTER INDEX IF EXISTS pulse_events_report_idx RENAME TO pulse_events_bootstrap_report_idx;
 END IF;
END $$;
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
) PARTITION BY HASH(site_id);
DO $$ BEGIN
 FOR i IN 0..15 LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS pulse_events_%s PARTITION OF pulse_events FOR VALUES WITH (MODULUS 16, REMAINDER %s)',i,i);
 END LOOP;
 IF to_regclass('public.pulse_events_bootstrap') IS NOT NULL THEN
  INSERT INTO pulse_events SELECT * FROM pulse_events_bootstrap ON CONFLICT(site_id,event_id) DO NOTHING;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS pulse_events_report_idx ON pulse_events(tenant_id,site_id,environment,occurred_at);
CREATE TABLE IF NOT EXISTS pulse_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS pulse_daily_aggregates (
 tenant_id uuid NOT NULL,site_id uuid NOT NULL,environment text NOT NULL,day date NOT NULL,
 pageviews bigint NOT NULL,sessions bigint NOT NULL,visitors bigint NOT NULL,events bigint NOT NULL,
 PRIMARY KEY(site_id,environment,day)
);
CREATE TABLE IF NOT EXISTS pulse_aggregate_state (id integer PRIMARY KEY CHECK(id=1),watermark timestamptz NOT NULL,last_completed_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS pulse_usage (
 tenant_id uuid NOT NULL,
 month date NOT NULL,
 billable bigint NOT NULL DEFAULT 0,
 stored bigint NOT NULL DEFAULT 0,
 refused bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,month)
);
COMMIT;
