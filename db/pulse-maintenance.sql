-- Idempotent aggregates are operational summaries. Do not sum daily distinct visitors
-- to calculate a multi-day visitor count; report exact distinct keys from retained raw data.
BEGIN;
SELECT pg_advisory_xact_lock(20881991);
WITH boundary AS (SELECT COALESCE((SELECT watermark FROM pulse_aggregate_state WHERE id=1),'epoch'::timestamptz) AS watermark), dirty AS (
 SELECT DISTINCT site_id,environment,(occurred_at AT TIME ZONE 'UTC')::date AS day FROM pulse_events,boundary WHERE received_at>=watermark-interval '24 hours'
), rebuilt AS (
 SELECT e.tenant_id,e.site_id,e.environment,d.day,count(*) FILTER(WHERE name='pageview') AS pageviews,count(DISTINCT session_key) AS sessions,count(DISTINCT visitor_key) FILTER(WHERE name='pageview') AS visitors,count(*) AS events
 FROM pulse_events e JOIN dirty d ON e.site_id=d.site_id AND e.environment=d.environment AND e.occurred_at>=d.day::timestamp AT TIME ZONE 'UTC' AND e.occurred_at<(d.day+1)::timestamp AT TIME ZONE 'UTC'
 WHERE name<>'pulse.verify' GROUP BY e.tenant_id,e.site_id,e.environment,d.day
)
INSERT INTO pulse_daily_aggregates SELECT * FROM rebuilt ON CONFLICT(site_id,environment,day) DO UPDATE SET pageviews=excluded.pageviews,sessions=excluded.sessions,visitors=excluded.visitors,events=excluded.events;
INSERT INTO pulse_aggregate_state(id,watermark,last_completed_at) VALUES(1,now(),now()) ON CONFLICT(id) DO UPDATE SET watermark=excluded.watermark,last_completed_at=excluded.last_completed_at;
DELETE FROM pulse_events WHERE (site_id,event_id) IN (SELECT site_id,event_id FROM pulse_events WHERE occurred_at<now()-interval '90 days' LIMIT 10000);
DELETE FROM pulse_rate_limits WHERE key IN (SELECT key FROM pulse_rate_limits WHERE expires_at<now() LIMIT 10000);
DELETE FROM pulse_daily_aggregates WHERE day<CURRENT_DATE-365;
DELETE FROM pulse_usage WHERE month<CURRENT_DATE-interval '25 months';
COMMIT;
