import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { bucketsFor, loadEvents, SAMPLE_BUCKETS } from "../../src/lib/analytics/storage";
import { summarizeEvents } from "../../src/lib/analytics/metrics";

const site = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  environment: "production",
  identityMode: "ephemeral",
} as any;

async function fixture(visitors: number, perVisitor: number, estimate: number) {
  const db = new PGlite();
  await db.exec(readFileSync("db/pulse-analytics.sql", "utf8"));
  await db.query(
    `insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path)
     select $1,$2,'production','e'||v||'_'||n,'pageview',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '12 hours'-(n||' seconds')::interval,md5('v'||v),md5('s'||v),'/'
     from generate_series(1,$3::int) v, generate_series(1,$4::int) n`,
    [site.id, site.tenantId, visitors, perVisitor],
  );
  await db.query(
    "insert into pulse_daily_aggregates values($1,$2,'production',current_date-1,$3,0,0,$3)",
    [site.tenantId, site.id, estimate],
  );
  const pool = { query: async (text: string, args?: unknown[]) => ({ rows: (await db.query(text, args)).rows as any[] }) };
  return { db, pool };
}

it("reads whole visitors and scales a sample back to accurate totals", async () => {
  const { db, pool } = await fixture(2000, 4, 8000);
  try {
    const { events, sample } = await loadEvents(site, new Date(Date.now() - 2 * 86_400_000), new Date(Date.now() + 60_000), pool as any, 2000);
    expect(sample).toBe(bucketsFor(8000, 2000) / SAMPLE_BUCKETS);
    expect(sample).toBe(0.25);
    expect(events.length).toBeLessThanOrEqual(2500);
    // Every sampled visitor arrives with all four of their events.
    const perVisitor = new Map<string, number>();
    for (const e of events) perVisitor.set(e.visitor, (perVisitor.get(e.visitor) || 0) + 1);
    expect([...perVisitor.values()].every((n) => n === 4)).toBe(true);
    const report = summarizeEvents(events, { range: 7, source: "", metric: "visitors", environment: "production", compare: true }, new Date(), { sample });
    expect(report.sample).toBe(0.25);
    expect(Math.abs(report.pageviews - 8000) / 8000).toBeLessThan(0.15);
    expect(Math.abs(report.visitors - 2000) / 2000).toBeLessThan(0.15);
  } finally {
    await db.close();
  }
}, 30000);

it("stays exact when the window fits, and shrinks the sample when aggregates lag a burst", async () => {
  const exact = await fixture(100, 3, 300);
  try {
    const r = await loadEvents(site, new Date(Date.now() - 2 * 86_400_000), undefined, exact.pool as any, 2000);
    expect(r.sample).toBe(1);
    expect(r.events).toHaveLength(300);
  } finally {
    await exact.db.close();
  }
  // The aggregates say nothing happened yet, but 8000 events arrived in the last minute.
  const lagging = await fixture(2000, 4, 0);
  try {
    const r = await loadEvents(site, new Date(Date.now() - 2 * 86_400_000), undefined, lagging.pool as any, 2000);
    expect(r.sample).toBeLessThan(1);
    expect(r.events.length).toBeLessThanOrEqual(2500);
  } finally {
    await lagging.db.close();
  }
}, 30000);

it("scales counts but never rates or percentiles", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const base = { path: "/", source: "Google", country: "US", device: "Desktop", environment: "production" };
  const events = [
    { ...base, id: "1", name: "pageview", visitor: "a", session: "s1", time: "2026-10-02T10:00:00Z" },
    { ...base, id: "2", name: "signup", visitor: "a", session: "s1", time: "2026-10-02T10:01:00Z" },
    { ...base, id: "3", name: "pageview", visitor: "b", session: "s2", time: "2026-10-02T11:00:00Z" },
  ] as any;
  const q = { range: 7, source: "", metric: "visitors", environment: "production", compare: true } as any;
  const exact = summarizeEvents(events, q, now, { goalNames: ["signup"] });
  const scaled = summarizeEvents(events, q, now, { goalNames: ["signup"], sample: 0.5 });
  expect(exact.sample).toBeNull();
  expect(scaled).toMatchObject({ visitors: 4, pageviews: 4, sessions: 4, conversions: 2, sample: 0.5 });
  expect(scaled.conversionRate).toBe(exact.conversionRate);
  expect(scaled.sources).toEqual([{ name: "Google", value: 4 }]);
  expect(scaled.series.reduce((a, p) => a + p.value, 0)).toBe(4);
});

it("plans buckets from the estimate", () => {
  expect(bucketsFor(0)).toBe(SAMPLE_BUCKETS);
  expect(bucketsFor(90_000)).toBe(SAMPLE_BUCKETS);
  expect(bucketsFor(180_000)).toBe(2048);
  expect(bucketsFor(10 ** 12)).toBe(1);
});

it("keeps live activity exact on a sampled report and serves refreshes from the cache", async () => {
  const { buildReport } = await import("../../src/lib/analytics/storage");
  const { db, pool } = await fixture(2000, 4, 8000);
  try {
    await db.query(
      "insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path) select $1,$2,'production','live'||g,'pageview',now()-interval '1 minute',md5('live'||g),md5('ls'||g),'/now' from generate_series(1,7) g",
      [site.id, site.tenantId],
    );
    let reads = 0;
    const counting = { query: (text: string, args?: unknown[]) => (reads++, pool.query(text, args)) };
    const q = { range: 7, source: "", metric: "visitors", environment: "production", compare: true, timezone: "UTC" } as any;
    const first = await buildReport(site, q, [], new Date(), counting as any, 2000);
    expect(first.sample).toBe(0.25);
    expect(first.live).toHaveLength(7);
    const before = reads;
    const again = await buildReport(site, q, [], new Date(), counting as any, 2000);
    // Only the live query runs again; the sampled window comes from the cache.
    expect(reads - before).toBe(1);
    expect(again.pageviews).toBe(first.pageviews);
    expect(again.live).toHaveLength(7);
  } finally {
    await db.close();
  }
}, 30000);

it("keeps historical recent events on cached and sampled reports", async () => {
  const { buildReport } = await import("../../src/lib/analytics/storage");
  const { db, pool } = await fixture(100, 3, 300);
  try {
    const now = new Date();
    const from = new Date(now.getTime()-3*86400000).toISOString().slice(0,10);
    const to = new Date(now.getTime()-86400000).toISOString().slice(0,10);
    const q = { range: 3, from, to, source: "", metric: "visitors", environment: "production", compare: true, timezone: "UTC" } as any;
    const first = await buildReport(site, q, [], now, pool as any);
    expect(first.recent.length).toBeGreaterThan(0);
    const cached = await buildReport(site, q, [], now, pool as any);
    expect(cached.recent.map(e=>e.id).sort()).toEqual(first.recent.map(e=>e.id).sort());
  } finally { await db.close(); }
}, 30000);

it("filters exact live activity before limiting recent traffic", async () => {
  const { buildReport } = await import("../../src/lib/analytics/storage");
  const { db, pool } = await fixture(100, 3, 300);
  try {
    await db.query("insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path,source) select $1,$2,'production','noise'||g,'pageview',now()-interval '1 minute',md5('n'||g),md5('ns'||g),'/', 'Noise' from generate_series(1,600) g", [site.id, site.tenantId]);
    await db.query("insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path,source) values($1,$2,'production','target','pageview',now()-interval '270 seconds',md5('target'),md5('target'),'/', 'Target')", [site.id, site.tenantId]);
    const q = { range: 7, source: "Target", metric: "visitors", environment: "production", compare: true, timezone: "UTC" } as any;
    const now = new Date();
    await buildReport(site, q, [], now, pool as any);
    const report = await buildReport(site, q, [], now, pool as any);
    expect(report.live.map(e=>e.id)).toEqual(["target"]);
  } finally { await db.close(); }
}, 30000);
