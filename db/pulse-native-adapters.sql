-- Portal-owned, opt-in adapters. Only enabled Pulse apps receive safe semantic events.
-- Source writes and outbox acceptance commit together; retries are deduplicated.
BEGIN;
CREATE TABLE IF NOT EXISTS pulse_business_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES pulse_sites(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('production','development')),
 event_id text NOT NULL,
 event_name text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 properties jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(site_id,event_id)
);
CREATE INDEX IF NOT EXISTS pulse_business_outbox_pending_idx ON pulse_business_outbox(created_at);
CREATE OR REPLACE FUNCTION pulse_capture_business_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 row_data jsonb := to_jsonb(NEW);
 previous_data jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 app_key text := TG_ARGV[0];
 event_name text := TG_ARGV[1];
 guard_field text := TG_ARGV[2];
 guard_value text := TG_ARGV[3];
 safe_properties jsonb := jsonb_build_object('source_app',app_key);
BEGIN
 IF TG_TABLE_NAME='project_cards' THEN
  row_data:=row_data||jsonb_build_object('tenant_id',(SELECT tenant_id FROM public.projects WHERE id=(row_data->>'project_id')::uuid));
 END IF;
 IF row_data->>'tenant_id' IS NULL OR row_data->>'id' IS NULL THEN RETURN NEW; END IF;
 IF guard_field='__version' THEN
  IF TG_OP='UPDATE' AND row_data->>'version' IS NOT DISTINCT FROM previous_data->>'version' THEN RETURN NEW; END IF;
 ELSIF guard_value='__not_null' THEN
  IF row_data->>guard_field IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND previous_data->>guard_field IS NOT NULL THEN RETURN NEW; END IF;
 ELSIF guard_field<>'' THEN
  IF row_data->>guard_field IS DISTINCT FROM guard_value THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND previous_data->>guard_field IS NOT DISTINCT FROM guard_value THEN RETURN NEW; END IF;
 ELSIF TG_OP='UPDATE' THEN RETURN NEW;
 END IF;
 IF event_name='purchase' THEN
  IF COALESCE(row_data->>'amount','') !~ '^[0-9]{1,15}$' OR COALESCE(row_data->>'currency','') !~ '^[A-Za-z]{3}$' THEN RETURN NEW; END IF;
  safe_properties:=safe_properties||jsonb_build_object('amountMinor',(row_data->>'amount')::bigint,'currency',upper(row_data->>'currency'));
 END IF;
 INSERT INTO public.pulse_business_outbox(site_id,tenant_id,environment,event_id,event_name,properties)
 SELECT s.id,s.tenant_id,s.environment,
  'native_'||md5(TG_TABLE_NAME||':'||(row_data->>'id')||':'||event_name||CASE WHEN guard_field='__version' THEN ':'||COALESCE(row_data->>'version','1') ELSE '' END),event_name,safe_properties
 FROM public.pulse_sites s
 WHERE s.tenant_id=(row_data->>'tenant_id')::uuid AND s.integration_key=app_key AND s.enabled=true AND s.environment='production'
 ON CONFLICT(site_id,event_id) DO NOTHING;
 RETURN NEW;
END $$;
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('messages','relay','message_sent','status','sent'),
 ('projects','lanes','project_created','',''),
 ('project_cards','lanes','task_completed','completed_at','__not_null'),
 ('office_documents','office','document_saved','__version',''),
 ('assets','folders','file_uploaded','',''),
 ('vibez_events','vibez','event_created','',''),
 ('events','suite','event_published','status','published'),
 ('attendees','suite','event_checked_in','status','checked_in'),
 ('orders','suite','order_captured','payment_status','captured'),
 ('tollbooth_payments','tollbooth','purchase','status','succeeded'),
 ('contacts','suite','contact_created','',''),
 ('newsletter_campaigns','suite','campaign_sent','status','sent'),
 ('tenant_memberships','suite','membership_added','','')
 ) AS adapters(table_name,app_key,event_name,guard_field,guard_value)
 LOOP
  IF to_regclass('public.'||item.table_name) IS NOT NULL THEN
   EXECUTE format('CREATE OR REPLACE TRIGGER pulse_capture AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pulse_capture_business_event(%L,%L,%L,%L)',item.table_name,item.app_key,item.event_name,item.guard_field,item.guard_value);
  END IF;
 END LOOP;
END $$;
COMMIT;
