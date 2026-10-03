-- Additive Pulse metadata migration. Owned by the AXXES portal.
BEGIN;
CREATE TABLE IF NOT EXISTS pulse_sites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 public_id text NOT NULL UNIQUE,
 name text NOT NULL,
 platform text NOT NULL,
 collection text NOT NULL CHECK(collection IN ('browser','server')),
 environment text NOT NULL CHECK(environment IN ('production','development')),
 allowed_origins jsonb NOT NULL DEFAULT '[]',
 timezone text NOT NULL DEFAULT 'UTC',
 identity_mode text NOT NULL DEFAULT 'ephemeral' CHECK(identity_mode IN ('ephemeral','persistent')),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,name,environment)
);
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
COMMIT;
