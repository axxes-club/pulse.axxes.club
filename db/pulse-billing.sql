-- Additive Pulse billing migration for the shared AXXES database. Pulse-owned, pulse_ prefixed;
-- touches no shared table. Payments (payments.axxes.app) takes the money; this records what an
-- organization is entitled to, written only from state read back from Payments on the server.
BEGIN;
CREATE TABLE IF NOT EXISTS pulse_billing (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 trial_started_at timestamptz NOT NULL DEFAULT now(),
 trial_ends_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 subscription_id text UNIQUE,
 subscription_status text,
 plan text,
 billing_interval text CHECK(billing_interval IN ('monthly','annual')),
 current_period_end timestamptz,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 owner_grant_at timestamptz,
 owner_grant_by text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Rerunnable upgrade for deployments that already have billing.
ALTER TABLE pulse_billing ADD COLUMN IF NOT EXISTS checkout_reservation jsonb;
CREATE TABLE IF NOT EXISTS pulse_billing_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 kind text NOT NULL,
 actor text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pulse_billing_audit_tenant_idx ON pulse_billing_audit(tenant_id,created_at);
COMMIT;
