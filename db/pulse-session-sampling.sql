-- Apply only to the isolated Pulse analytics database after checking production row count.
-- PostgreSQL does not support CONCURRENTLY on a partitioned parent. Fail quickly if busy.
-- Match the session bucket expression used by loadEvents; daily visitor hashes still rotate.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE INDEX IF NOT EXISTS pulse_events_session_sample_idx
ON pulse_events(tenant_id,site_id,environment,(('x'||substr(session_key,1,3))::bit(12)::int),occurred_at);
COMMIT;
