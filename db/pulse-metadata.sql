-- Additive Pulse metadata migration. Owned by the AXXES portal.
BEGIN;
CREATE TABLE IF NOT EXISTS pulse_sites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 public_id text NOT NULL UNIQUE,
 name text NOT NULL,
 platform text NOT NULL,
 integration_key text,
 collection text NOT NULL CHECK(collection IN ('browser','server')),
 environment text NOT NULL CHECK(environment IN ('production','development')),
 allowed_origins jsonb NOT NULL DEFAULT '[]',
 timezone text NOT NULL DEFAULT 'UTC',
 identity_mode text NOT NULL DEFAULT 'ephemeral' CHECK(identity_mode IN ('ephemeral','persistent')),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,name,environment)
);
ALTER TABLE pulse_sites ADD COLUMN IF NOT EXISTS integration_key text;
CREATE INDEX IF NOT EXISTS pulse_sites_tenant_idx ON pulse_sites(tenant_id);
CREATE TABLE IF NOT EXISTS pulse_server_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES pulse_sites(id) ON DELETE CASCADE,
 secret_hash text NOT NULL UNIQUE,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pulse_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES pulse_sites(id) ON DELETE CASCADE,
 event_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(site_id,event_name)
);
CREATE TABLE IF NOT EXISTS pulse_funnels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL REFERENCES pulse_sites(id) ON DELETE CASCADE,
 name text NOT NULL,
 steps jsonb NOT NULL,
 window_ms integer NOT NULL DEFAULT 1800000,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pulse_verifications (
 token_hash text PRIMARY KEY,
 site_id uuid NOT NULL REFERENCES pulse_sites(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN ('production','development')),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pulse_verifications' AND column_name='token') THEN
  ALTER TABLE pulse_verifications RENAME COLUMN token TO token_hash;
  UPDATE pulse_verifications SET token_hash=encode(sha256(convert_to(token_hash,'UTF8')),'hex');
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS pulse_verifications_site_idx ON pulse_verifications(site_id,expires_at);
CREATE TABLE IF NOT EXISTS pulse_session_handoffs (
 code_hash text PRIMARY KEY,
 state_hash text NOT NULL,
 session_id text NOT NULL REFERENCES session(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '60 seconds'
);
CREATE TABLE IF NOT EXISTS pulse_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 site_id uuid REFERENCES pulse_sites(id) ON DELETE SET NULL,
 kind text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pulse_activity_tenant_idx ON pulse_activity(tenant_id,created_at);
CREATE OR REPLACE FUNCTION pulse_capture_metadata_activity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE tenant uuid; site uuid; kind text;
BEGIN
 IF TG_TABLE_NAME='pulse_sites' THEN
  tenant:=NEW.tenant_id;site:=NEW.id;
  IF TG_OP='INSERT' THEN kind:='app_created';
  ELSIF NEW.enabled IS DISTINCT FROM OLD.enabled THEN kind:=CASE WHEN NEW.enabled THEN 'collection_enabled' ELSE 'collection_paused' END;
  ELSE RETURN NEW;END IF;
 ELSE
  site:=NEW.site_id;SELECT tenant_id INTO tenant FROM public.pulse_sites WHERE id=site;
  IF TG_TABLE_NAME='pulse_goals' THEN kind:='goal_created';
  ELSIF TG_TABLE_NAME='pulse_funnels' THEN kind:='funnel_created';
  ELSIF TG_OP='INSERT' THEN kind:='credential_created';
  ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN kind:='credential_revoked';
  ELSE RETURN NEW;END IF;
 END IF;
 INSERT INTO public.pulse_activity(tenant_id,site_id,kind) VALUES(tenant,site,kind);
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER pulse_metadata_activity AFTER INSERT OR UPDATE ON pulse_sites FOR EACH ROW EXECUTE FUNCTION pulse_capture_metadata_activity();
CREATE OR REPLACE TRIGGER pulse_metadata_activity AFTER INSERT ON pulse_goals FOR EACH ROW EXECUTE FUNCTION pulse_capture_metadata_activity();
CREATE OR REPLACE TRIGGER pulse_metadata_activity AFTER INSERT ON pulse_funnels FOR EACH ROW EXECUTE FUNCTION pulse_capture_metadata_activity();
CREATE OR REPLACE TRIGGER pulse_metadata_activity AFTER INSERT OR UPDATE ON pulse_server_credentials FOR EACH ROW EXECUTE FUNCTION pulse_capture_metadata_activity();
COMMIT;
