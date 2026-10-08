import "server-only";
import { z } from "zod";
import { metadataPool, analyticsPool } from "@/lib/analytics/postgres";
import type { SubscriptionSnapshot } from "@/lib/axxes-payments";
import {
  allowanceFor,
  resolveEntitlement,
  subscriptionIsLive,
  usageMonth,
  type Allowance,
  type BillingRow,
  type Entitlement,
} from "./entitlement";
import { OVERAGE_GRACE, STORED_CAP, TRIAL_EVENTS, parseLookupKey } from "./plans";

const columns = `tenant_id as "tenantId", trial_ends_at as "trialEndsAt", subscription_id as "subscriptionId",
 subscription_status as "subscriptionStatus", plan, billing_interval as "interval", current_period_end as "currentPeriodEnd",
 cancel_at_period_end as "cancelAtPeriodEnd", owner_grant_at as "ownerGrantAt"`;

/**
 * The organization's billing row. The first time Pulse sees an organization its 30-day
 * trial starts, so every existing and new organization gets the same trial exactly once.
 */
export async function billingRow(tenantId: string): Promise<BillingRow> {
  const pool = metadataPool();
  const existing = await pool.query<BillingRow>(`select ${columns} from pulse_billing where tenant_id=$1`, [tenantId]);
  if (existing.rows[0]) return existing.rows[0];
  await pool.query("insert into pulse_billing(tenant_id) values($1) on conflict(tenant_id) do nothing", [tenantId]);
  const created = await pool.query<BillingRow>(`select ${columns} from pulse_billing where tenant_id=$1`, [tenantId]);
  return created.rows[0];
}

// Collection checks the plan on every batch, so entitlements are cached briefly per instance.
// A change made here clears this instance at once; other instances catch up within a minute.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Entitlement }>();
export async function entitlementFor(tenantId: string, now = new Date()): Promise<Entitlement> {
  const hit = cache.get(tenantId);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.value;
  const value = resolveEntitlement(await billingRow(tenantId), now);
  if (cache.size > 5000) cache.clear();
  cache.set(tenantId, { at: now.getTime(), value });
  return value;
}
export const forget = (tenantId: string) => cache.delete(tenantId);

/**
 * The ceilings collection enforces. If billing cannot be read, collection keeps going within a
 * trial-sized bound rather than losing a customer's events to an outage of ours.
 */
export async function allowance(tenantId: string): Promise<Allowance> {
  try {
    return allowanceFor(await entitlementFor(tenantId));
  } catch (e) {
    console.error("pulse_billing_unavailable", e instanceof Error ? e.name : "unknown");
    return { billable: Math.floor(TRIAL_EVENTS * OVERAGE_GRACE), stored: TRIAL_EVENTS * STORED_CAP };
  }
}

export async function monthUsage(tenantId: string, now = new Date()) {
  const result = await analyticsPool().query(
    "select billable,stored,refused from pulse_usage where tenant_id=$1 and month=$2",
    [tenantId, usageMonth(now)],
  );
  const row = result.rows[0];
  return {
    billable: Number(row?.billable || 0),
    stored: Number(row?.stored || 0),
    refused: Number(row?.refused || 0),
  };
}

export async function audit(tenantId: string, kind: string, actor: string, details: Record<string, unknown> = {}) {
  await metadataPool().query(
    "insert into pulse_billing_audit(tenant_id,kind,actor,details) values($1,$2,$3,$4::jsonb)",
    [tenantId, kind, actor, JSON.stringify(details)],
  );
}

const reference = z.string().uuid();

/**
 * Records a subscription snapshot that was read from AXXES Payments on the server. The snapshot
 * is the only writer of plan state; browsers and redirects only ever point at one.
 */
export async function applySubscription(snapshot: SubscriptionSnapshot, actor: string) {
  if (snapshot.product !== "pulse" || !reference.safeParse(snapshot.reference).success) return { applied: false };
  const tenantId = snapshot.reference;
  const parsed = parseLookupKey(snapshot.lookup_key);
  const client = await metadataPool().connect();
  try {
    await client.query("begin");
    await client.query("insert into pulse_billing(tenant_id) values($1) on conflict(tenant_id) do nothing", [tenantId]);
    const current = (
      await client.query<BillingRow>(`select ${columns} from pulse_billing where tenant_id=$1 for update`, [tenantId])
    ).rows[0];
    if (!current) {
      await client.query("rollback");
      return { applied: false };
    }
    const incomingLive = subscriptionIsLive(
      {
        subscriptionStatus: snapshot.status,
        currentPeriodEnd: snapshot.current_period_end ? new Date(snapshot.current_period_end * 1000) : null,
      },
      new Date(),
    );
    // An ended subscription never closes access that a different, still-live subscription pays for.
    if (
      current.subscriptionId &&
      current.subscriptionId !== snapshot.id &&
      subscriptionIsLive(current, new Date()) &&
      !incomingLive
    ) {
      await client.query("rollback");
      return { applied: false };
    }
    await client.query(
      `update pulse_billing set subscription_id=$2, subscription_status=$3, plan=$4, billing_interval=$5,
       current_period_end=$6, cancel_at_period_end=$7, updated_at=now() where tenant_id=$1`,
      [
        tenantId,
        snapshot.id,
        snapshot.status,
        parsed?.plan.key ?? null,
        parsed?.interval ?? null,
        snapshot.current_period_end ? new Date(snapshot.current_period_end * 1000) : null,
        snapshot.cancel_at_period_end,
      ],
    );
    // A subscription with the same ID can be moved to another tenant only by Stripe metadata,
    // which Payments never changes; the unique constraint rejects anything else.
    await client.query(
      "insert into pulse_billing_audit(tenant_id,kind,actor,details) values($1,'subscription_updated',$2,$3::jsonb)",
      [tenantId, actor, JSON.stringify({ subscription: snapshot.id, status: snapshot.status, lookupKey: snapshot.lookup_key })],
    );
    await client.query("commit");
    forget(tenantId);
    return { applied: true, tenantId };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * The AXXES owner's own account uses Pulse free (owner decision 2026-10-07). The exemption is
 * bound to one verified account ID, never to superadmins in general or to an email claim, and
 * it is applied to an organization only by an explicit, audited action of that account.
 */
export async function isPlatformOwner(userId: string) {
  const owner = process.env.AXXES_OWNER_USER_ID;
  if (!owner || owner.length < 16 || userId !== owner) return false;
  const result = await metadataPool().query<{ is_superadmin: boolean }>(
    'select is_superadmin from "user" where id=$1',
    [userId],
  );
  return result.rows[0]?.is_superadmin === true;
}

export async function setOwnerGrant(tenantId: string, userId: string, granted: boolean) {
  await billingRow(tenantId);
  await metadataPool().query(
    granted
      ? "update pulse_billing set owner_grant_at=now(), owner_grant_by=$2, updated_at=now() where tenant_id=$1"
      : "update pulse_billing set owner_grant_at=null, owner_grant_by=null, updated_at=now() where tenant_id=$1 and owner_grant_by=$2",
    [tenantId, userId],
  );
  await audit(tenantId, granted ? "owner_access_granted" : "owner_access_removed", userId);
  forget(tenantId);
}
