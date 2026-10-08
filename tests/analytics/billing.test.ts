import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  admit,
  allowanceFor,
  resolveEntitlement,
  usageMonth,
  type BillingRow,
} from "../../src/lib/billing/entitlement";
import { PLANS, lookupKey, parseLookupKey, planFor, TRIAL_EVENTS } from "../../src/lib/billing/plans";
import { persistBatch } from "../../src/lib/analytics/storage";
import { verifyPaymentsEvent } from "../../src/lib/axxes-payments";

const now = new Date("2026-10-15T12:00:00Z");
const day = 86_400_000;
const row = (over: Partial<BillingRow> = {}): BillingRow => ({
  tenantId: "22222222-2222-4222-8222-222222222222",
  trialEndsAt: new Date(now.getTime() + 10 * day),
  subscriptionId: null,
  subscriptionStatus: null,
  plan: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  ownerGrantAt: null,
  ...over,
});
const paid = (over: Partial<BillingRow> = {}) =>
  row({
    trialEndsAt: new Date(now.getTime() - 40 * day),
    subscriptionId: "sub_12345678",
    subscriptionStatus: "active",
    plan: "e1m",
    interval: "monthly",
    currentPeriodEnd: new Date(now.getTime() + 20 * day),
    ...over,
  });

describe("plans", () => {
  it("ascend in volume and price, with annual at ten months", () => {
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].events).toBeGreaterThan(PLANS[i - 1].events);
      expect(PLANS[i].monthly).toBeGreaterThan(PLANS[i - 1].monthly);
    }
    for (const p of PLANS) expect(p.annual).toBe(p.monthly * 10);
  });
  it("round-trip lookup keys and ignore other products' prices", () => {
    for (const p of PLANS)
      for (const interval of ["monthly", "annual"] as const)
        expect(parseLookupKey(lookupKey(p, interval))).toEqual({ plan: p, interval });
    expect(parseLookupKey("vitrine_collector_monthly")).toBeNull();
    expect(parseLookupKey("pulse_e7m_monthly")).toBeNull();
    expect(parseLookupKey(null)).toBeNull();
  });
  it("match the Stripe price script exactly", () => {
    const script = readFileSync("scripts/pulse-stripe-prices.mjs", "utf8");
    const listed = [...script.matchAll(/\["(e[0-9a-z]+)", "[^"]+", (\d+)\]/g)].map((m) => [m[1], Number(m[2])]);
    expect(listed).toEqual(PLANS.map((p) => [p.key, p.monthly]));
    expect(script).toContain("amount: monthly * 10");
  });
  it("recommend the smallest plan that covers a volume", () => {
    expect(planFor(1)?.key).toBe("e25k");
    expect(planFor(100_000)?.key).toBe("e100k");
    expect(planFor(100_001)?.key).toBe("e250k");
    expect(planFor(20_000_000)).toBeNull();
  });
});

describe("entitlement", () => {
  it("gives every organization a collecting trial with the trial allowance", () => {
    const e = resolveEntitlement(row(), now);
    expect(e).toMatchObject({ status: "trial", collecting: true, included: TRIAL_EVENTS });
  });
  it("pauses collection after the trial without a plan, but never deletes anything", () => {
    const e = resolveEntitlement(row({ trialEndsAt: new Date(now.getTime() - day) }), now);
    expect(e).toMatchObject({ status: "trial_ended", collecting: false });
    expect(allowanceFor(e)).toEqual({ billable: 0, stored: 0 });
  });
  it("honours an active plan, a failed-payment grace and the renewal gap", () => {
    expect(resolveEntitlement(paid(), now)).toMatchObject({ status: "active", included: 1_000_000 });
    expect(resolveEntitlement(paid({ subscriptionStatus: "past_due" }), now)).toMatchObject({
      status: "past_due",
      collecting: true,
    });
    // A renewal event that is a day late does not interrupt collection...
    expect(resolveEntitlement(paid({ currentPeriodEnd: new Date(now.getTime() - day) }), now).collecting).toBe(true);
    // ...but a period that ended long ago without renewal does.
    expect(resolveEntitlement(paid({ currentPeriodEnd: new Date(now.getTime() - 5 * day) }), now).collecting).toBe(false);
  });
  it("ends access when the subscription is canceled or unpaid", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired", "incomplete"])
      expect(resolveEntitlement(paid({ subscriptionStatus: status }), now)).toMatchObject({
        status: "canceled",
        collecting: false,
      });
  });
  it("never shrinks the trial allowance when a plan is chosen early", () => {
    const e = resolveEntitlement(paid({ plan: "e25k", subscriptionStatus: "trialing", trialEndsAt: new Date(now.getTime() + day) }), now);
    expect(e.included).toBe(TRIAL_EVENTS);
  });
  it("ignores a subscription on a price Pulse does not sell", () => {
    expect(resolveEntitlement(paid({ plan: "unknown" }), now).collecting).toBe(false);
  });
  it("gives owner access unlimited collection regardless of subscription state", () => {
    const e = resolveEntitlement(paid({ subscriptionStatus: "canceled", ownerGrantAt: now }), now);
    expect(e).toMatchObject({ status: "owner", collecting: true, included: null });
    expect(allowanceFor(e)).toEqual({ billable: null, stored: null });
  });
  it("admits up to the grace ceiling, then refuses; drops only performance samples past the storage ceiling", () => {
    const allowance = allowanceFor(resolveEntitlement(paid({ plan: "e25k" }), now));
    expect(allowance).toEqual({ billable: 37_500, stored: 100_000 });
    expect(admit({ billable: 30_000, stored: 30_000 }, allowance)).toBe("accept");
    expect(admit({ billable: 37_500, stored: 40_000 }, allowance)).toBe("refuse");
    expect(admit({ billable: 1_000, stored: 100_000 }, allowance)).toBe("accept_billable_only");
    expect(admit({ billable: 10 ** 9, stored: 10 ** 9 }, { billable: null, stored: null })).toBe("accept");
  });
  it("meters by UTC calendar month", () => {
    expect(usageMonth(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-01");
    expect(usageMonth(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });
});

describe("metered collection", () => {
  async function fixture() {
    const db = new PGlite();
    await db.exec(readFileSync("db/pulse-analytics.sql", "utf8"));
    process.env.PULSE_HASH_SECRET = "test-only-secret-at-least-32-characters-long";
    const database = {
      connect: async () => ({
        query: async (text: string, args?: unknown[]) => {
          const r = await db.query(text, args);
          return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
        },
        release: () => {},
      }),
    };
    const site = {
      id: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      environment: "production",
      collection: "server",
      identityMode: "ephemeral",
    } as any;
    let n = 0;
    const batch = (names: string[]) =>
      ({
        schemaVersion: 1,
        siteId: "app_fixture",
        environment: "production",
        events: names.map((name) => ({ id: `e${n++}`, name, timestamp: new Date().toISOString(), url: "https://example.com/" })),
      }) as any;
    const send = (names: string[], allowance?: { billable: number | null; stored: number | null }) =>
      persistBatch(site, batch(names), { ip: "server", userAgent: "trusted-server" }, true, database, allowance);
    const usage = async () =>
      (await db.query("select billable::int,stored::int,refused::int from pulse_usage")).rows[0] as any;
    return { db, send, usage };
  }

  it("counts billable events and performance samples separately, and not duplicates", async () => {
    const { db, send, usage } = await fixture();
    try {
      await send(["pageview", "signup", "web_vital", "pulse.verify"], { billable: 100, stored: 400 });
      expect(await usage()).toEqual({ billable: 2, stored: 4, refused: 0 });
      // Unmetered storage (tests, tools) does not count.
      await send(["pageview"]);
      expect(await usage()).toEqual({ billable: 2, stored: 4, refused: 0 });
    } finally {
      await db.close();
    }
  }, 20000);

  it("refuses batches past the ceiling with 402, records the refusal and stores nothing", async () => {
    const { db, send, usage } = await fixture();
    try {
      await send(["pageview", "pageview"], { billable: 2, stored: 8 });
      await expect(send(["pageview"], { billable: 2, stored: 8 })).rejects.toMatchObject({ status: 402 });
      expect(await usage()).toEqual({ billable: 2, stored: 2, refused: 1 });
      expect((await db.query("select count(*)::int as c from pulse_events")).rows[0]).toEqual({ c: 2 });
    } finally {
      await db.close();
    }
  }, 20000);

  it("refuses a batch that would cross the billable ceiling", async () => {
    const { db, send, usage } = await fixture();
    try {
      await send(["pageview"], { billable: 2, stored: 8 });
      await expect(send(["pageview", "pageview"], { billable: 2, stored: 8 })).rejects.toMatchObject({ status: 402 });
      expect(await usage()).toEqual({ billable: 1, stored: 1, refused: 2 });
    } finally { await db.close(); }
  }, 20000);

  it("refuses an organization without a plan before touching storage", async () => {
    const { db, send } = await fixture();
    try {
      await expect(send(["pageview"], { billable: 0, stored: 0 })).rejects.toMatchObject({ status: 402 });
      expect((await db.query("select count(*)::int as c from pulse_rate_limits")).rows[0]).toEqual({ c: 0 });
    } finally {
      await db.close();
    }
  }, 20000);

  it("keeps pageviews but drops performance samples past the storage ceiling", async () => {
    const { db, send, usage } = await fixture();
    try {
      await send(["web_vital", "web_vital"], { billable: 100, stored: 2 });
      const result = await send(["pageview", "web_vital"], { billable: 100, stored: 2 });
      expect(result).toEqual({ accepted: 1, duplicates: 0, dropped: 1 });
      expect(await usage()).toEqual({ billable: 1, stored: 3, refused: 0 });
    } finally {
      await db.close();
    }
  }, 20000);
});

describe("billing migration", () => {
  it("applies additively and repeatably beside the shared tables it references", async () => {
    const db = new PGlite();
    try {
      await db.exec('create table tenants(id uuid primary key); create table "user"(id text primary key, is_superadmin boolean not null default false);');
      await db.exec(readFileSync("db/pulse-billing.sql", "utf8"));
      await db.exec(readFileSync("db/pulse-billing.sql", "utf8"));
      await db.exec("insert into tenants values('22222222-2222-4222-8222-222222222222')");
      await db.exec("insert into pulse_billing(tenant_id) values('22222222-2222-4222-8222-222222222222')");
      const r = (
        await db.query<{ days: number }>("select round(extract(epoch from trial_ends_at-trial_started_at)/86400)::int as days from pulse_billing")
      ).rows[0];
      expect(r.days).toBe(30);
      await expect(db.exec("update pulse_billing set billing_interval='weekly'")).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 20000);
});

describe("payments events", () => {
  const secret = "e".repeat(64);
  const sign = (body: string, t: number, key = secret) =>
    `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  it("accept only fresh events signed with Pulse's secret", () => {
    process.env.AXXES_PAYMENTS_EVENT_SECRET = secret;
    const body = JSON.stringify({ id: "evt_1", product: "pulse" });
    const t = Math.floor(Date.now() / 1000);
    expect(verifyPaymentsEvent(body, sign(body, t))?.id).toBe("evt_1");
    expect(verifyPaymentsEvent(body + " ", sign(body, t))).toBeNull();
    expect(verifyPaymentsEvent(body, sign(body, t, "o".repeat(64)))).toBeNull();
    expect(verifyPaymentsEvent(body, sign(body, t - 400))).toBeNull();
    expect(verifyPaymentsEvent(body, null)).toBeNull();
  });
});
