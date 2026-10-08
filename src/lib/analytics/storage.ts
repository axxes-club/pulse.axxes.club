import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AnalyticsEvent, AnalyticsReport } from "./types";
import type { EventBatch } from "./validation";
import { sanitizeUrl, safeSource, visitorKey } from "./validation";
import type { AnalyticsSite } from "./sites";
import { analyticsPool } from "./postgres";
import { reportWindow } from "./timezone";
import { AnalyticsError } from "./access";
import { summarizeEvents } from "./metrics";
import type { ReportQuery } from "./query";
import { admit, isBillable, usageMonth, type Allowance } from "@/lib/billing/entitlement";
export async function persistBatch(
  site: AnalyticsSite,
  batch: EventBatch,
  request: { ip: string; userAgent: string; country?: string },
  trusted = false,
  database?: {
    connect: () => Promise<{
      query: (
        text: string,
        args?: unknown[],
      ) => Promise<{ rows: any[]; rowCount: number | null }>;
      release: () => void;
    }>;
  },
  /** The organization's monthly ceilings. Omitted only by tests that exercise storage alone. */
  allowance?: Allowance,
) {
  if (batch.environment !== site.environment)
    throw new AnalyticsError("Wrong app environment");
  if (!trusted && site.collection !== "browser")
    throw new AnalyticsError("Use scoped server credentials for this app", 403);
  // No active plan: refuse before touching storage, so idle sites with a leftover script cost nothing.
  if (allowance?.billable === 0)
    throw new AnalyticsError("Collection is paused: this organization has no active Pulse plan", 402);
  const secret = process.env.PULSE_HASH_SECRET;
  if (!secret || secret.length < 32)
    throw new AnalyticsError("Collection is not configured yet", 503);
  const now = new Date(),
    rotation = now.toISOString().slice(0, 10);
  const visitor = visitorKey(
    secret,
    site.id,
    request.ip,
    request.userAgent,
    rotation,
  );
  const client = await (database || analyticsPool()).connect();
  let accepted = 0,
    refused = false;
  try {
    await client.query("begin");
    const minute = Math.floor(now.getTime() / 60000);
    const key = createHash("sha256")
      .update(`${site.id}:${visitor}:${minute}`)
      .digest("hex");
    const rate = await client.query(
      "insert into pulse_rate_limits(key,count,expires_at) values($1,$2,now()+interval '2 minutes') on conflict(key) do update set count=pulse_rate_limits.count+excluded.count returning count",
      [key, batch.events.length],
    );
    if (rate.rows[0].count > 300)
      throw new AnalyticsError("Collection rate exceeded; retry later", 429);
    const month = usageMonth(now);
    let events = batch.events;
    if (allowance) {
      // Establish and lock one tenant/month row before admitting any concurrent batch.
      await client.query("insert into pulse_usage(tenant_id,month) values($1,$2) on conflict(tenant_id,month) do nothing", [site.tenantId, month]);
      const usage = await client.query(
        "select billable,stored from pulse_usage where tenant_id=$1 and month=$2 for update",
        [site.tenantId, month],
      );
      const current = { billable: Number(usage.rows[0]?.billable || 0), stored: Number(usage.rows[0]?.stored || 0) };
      const existing = await client.query("select event_id from pulse_events where site_id=$1 and event_id=any($2::text[])", [site.id, events.map(e=>e.id)]);
      const seen = new Set<string>(existing.rows.map(row=>row.event_id));
      let incomingBillable = 0;
      let availableStored = allowance.stored === null ? Infinity : Math.max(0, allowance.stored-current.stored);
      events = events.filter(event => {
        if (seen.has(event.id)) return true;
        if (isBillable(event.name)) { seen.add(event.id); incomingBillable++; availableStored--; return true; }
        if (availableStored <= 0) return false;
        seen.add(event.id); availableStored--; return true;
      });
      const decision = admit(current, allowance);
      if (decision === "refuse" || (allowance.billable !== null && current.billable+incomingBillable>allowance.billable)) {
        await client.query(
          "insert into pulse_usage(tenant_id,month,refused) values($1,$2,$3) on conflict(tenant_id,month) do update set refused=pulse_usage.refused+excluded.refused,updated_at=now()",
          [site.tenantId, month, events.length],
        );
        await client.query("commit");
        refused = true;
        throw new AnalyticsError(
          "Collection is paused: this organization reached its monthly Pulse event limit",
          402,
        );
      }

    }
    let billable = 0,
      stored = 0;
    // received_at=now() stays true for every update to a row inserted in this transaction.
    const countedInsertions = new Set<string>();
    for (const event of events) {
      if(event.anonymousVisitorId&&(!trusted||site.collection!=='server'))throw new AnalyticsError('Anonymous visitor hashes require scoped server credentials',403);
      if(event.anonymousVisitorId&&(site.identityMode!=='ephemeral'||event.visitorId||event.sessionId))throw new AnalyticsError('Anonymous visitor hashes require ephemeral identity without explicit visitor or session IDs');
      if (
        !trusted &&
        ["purchase", "revenue", "payment_captured"].includes(event.name)
      )
        throw new AnalyticsError(
          "Revenue events require trusted server credentials",
          403,
        );
      const sanitized = event.url
        ? sanitizeUrl(event.url)
        : { path: "/", campaign: {} };
      if (event.name === "purchase") {
        const p = event.properties;
        if (
          !p ||
          !Number.isSafeInteger(p.amountMinor) ||
          Number(p.amountMinor)<0 ||
          typeof p.currency !== "string" ||
          !/^[A-Z]{3}$/.test(p.currency)
        )
          throw new AnalyticsError(
            "Purchases need integer amountMinor and currency",
          );
      }
      if (event.visitorId && site.identityMode !== "persistent")
        throw new AnalyticsError(
          "Persistent identity is not enabled for this app",
        );
      const eventVisitor = event.anonymousVisitorId
        ? visitorKey(secret,site.id,event.anonymousVisitorId,'anonymous-server',rotation)
        : event.visitorId
        ? visitorKey(
            secret,
            site.id,
            event.visitorId,
            "persistent",
            "persistent",
          )
        : visitor;
      const session = event.sessionId
        ? visitorKey(secret, site.id, event.sessionId, "session", "session")
        : visitorKey(
            secret,
            site.id,
            event.anonymousVisitorId ? eventVisitor : trusted ? event.id : visitor,
            String(Math.floor(Date.parse(event.timestamp) / 1800000)),
            rotation,
          );
      const device = /mobile|android|iphone/i.test(request.userAgent)
        ? "Mobile"
        : request.userAgent
          ? "Desktop"
          : "Unknown";
      const result = await client.query(
        "insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path,source,country,device,properties) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) on conflict(site_id,event_id) do update set properties=excluded.properties,occurred_at=excluded.occurred_at where pulse_events.name='web_vital' and excluded.name='web_vital' and excluded.occurred_at>=pulse_events.occurred_at returning event_id,(received_at=now()) as inserted",
        [
          site.id,
          site.tenantId,
          batch.environment,
          event.id,
          event.name,
          event.timestamp,
          eventVisitor,
          session,
          sanitized.path,
          safeSource(event.referrer, sanitized.campaign),
          request.country || "Unknown",
          device,
          JSON.stringify({
            ...event.properties,
            ...sanitized.campaign,
            pulse_collection: trusted ? "server" : "browser",
            // This provenance is server-owned; client claims cannot make anonymous history durable.
            __pulse_identity: event.visitorId && site.identityMode === "persistent" ? "persistent" : "ephemeral",
          }),
        ],
      );
      accepted += result.rowCount || 0;
      if (result.rows[0]?.inserted && !countedInsertions.has(event.id)) {
        countedInsertions.add(event.id);
        stored++;
        if (isBillable(event.name)) billable++;
      }
    }
    if (allowance && stored)
      await client.query(
        "insert into pulse_usage(tenant_id,month,billable,stored) values($1,$2,$3,$4) on conflict(tenant_id,month) do update set billable=pulse_usage.billable+excluded.billable,stored=pulse_usage.stored+excluded.stored,updated_at=now()",
        [site.tenantId, month, billable, stored],
      );
    await client.query("commit");
    const dropped = batch.events.length - events.length;
    return { accepted, duplicates: events.length - accepted, ...(dropped ? { dropped } : {}) };
  } catch (e) {
    if (!refused) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
/**
 * Visitors and sessions have separate sampling buckets. Daily visitor rotation can split a
 * midnight session, so session metrics and funnels must use the session expression instead.
 * Keep these expressions identical to their indexes in db/pulse-analytics.sql.
 */
const BUCKET = "(('x'||substr(visitor_key,1,3))::bit(12)::int)";
const SESSION_BUCKET = "(('x'||substr(session_key,1,3))::bit(12)::int)";
export const SAMPLE_BUCKETS = 4096;
/** Target rows per sampling query; larger windows return a bounded visitor/session sample. */
export const RAW_LIMIT = 90_000;
const columns =
  "event_id as id,name,occurred_at as time,visitor_key as visitor,session_key as session,path,source,country,device,environment,properties";
type Pool = Pick<ReturnType<typeof analyticsPool>, "query">;
const toEvents = (rows: any[]) =>
  rows.map((e) => ({ ...e, time: new Date(e.time).toISOString() })) as AnalyticsEvent[];

/** Buckets to read so a window of about `estimate` rows stays within the limit. */
export const bucketsFor = (estimate: number, limit = RAW_LIMIT) =>
  estimate <= limit ? SAMPLE_BUCKETS : Math.max(1, Math.floor((SAMPLE_BUCKETS * limit) / estimate));

/**
 * Raw events for a report window, sampled by visitor or session when the window is large.
 * `sample` is the share of the selected counting unit (1 when exact). Each read retains the
 * same RAW_LIMIT target and bounded 25% sampling headroom, regardless of the counting unit.
 */
export async function loadEvents(
  site: AnalyticsSite,
  from: Date,
  to: Date = new Date(Date.now() + 60_000),
  pool: Pool = analyticsPool(),
  limit = RAW_LIMIT,
  sampleBy: "visitor" | "session" = "visitor",
) {
  const bucket = sampleBy === "session" ? SESSION_BUCKET : BUCKET;
  const estimate = await pool.query(
    "select coalesce(sum(events),0)::bigint as n from pulse_daily_aggregates where site_id=$1 and environment=$2 and day>=($3::timestamptz at time zone 'UTC')::date and day<=($4::timestamptz at time zone 'UTC')::date",
    [site.id, site.environment, from, to],
  );
  let buckets = bucketsFor(Number(estimate.rows[0]?.n || 0), limit);
  for (let attempt = 0; attempt < 6; attempt++) {
    const sampled = buckets < SAMPLE_BUCKETS;
    const result = await pool.query(
      `select ${columns} from pulse_events where tenant_id=$1 and site_id=$2 and environment=$3 and occurred_at>=$4::timestamptz and occurred_at<$5::timestamptz${sampled ? ` and ${bucket}<$7` : ""} order by occurred_at desc limit $6`,
      [site.tenantId, site.id, site.environment, from, to, Math.floor(limit * 1.25) + 1, ...(sampled ? [buckets] : [])],
    );
    if (result.rows.length <= Math.floor(limit * 1.25))
      return { events: toEvents(result.rows), sample: buckets / SAMPLE_BUCKETS };
    // The aggregates lag a burst of traffic by up to a minute: read a smaller share and retry.
    if (buckets === 1) break;
    buckets = Math.max(1, Math.floor(buckets / 4));
  }
  throw new AnalyticsError("This report window is too large to load right now. Choose a shorter range.", 422);
}

/** Exact activity is filtered before limiting, including entry attribution for source/campaign. */
export async function latestEvents(site: AnalyticsSite, before: Date, pool: Pool = analyticsPool(), query?: ReportQuery, from?: Date, to?: Date, attributionFrom?: Date) {
  const filters: Partial<ReportQuery> = query || { source: "", environment: site.environment };
  if (filters.environment !== site.environment) return [];
  const args: unknown[] = [site.tenantId, site.id, site.environment, new Date(before.getTime()-300_000), before, from || new Date(before.getTime()-86_400_000), to || before, attributionFrom || new Date(0)];
  const conditions = ["name<>'pulse.verify'"];
  for (const field of ["source", "path", "country", "device"] as const) {
    if (filters[field]) { args.push(filters[field]); conditions.push(`${field}=$${args.length}`); }
  }
  if (filters.campaign) { args.push(filters.campaign); conditions.push(`coalesce(properties->>'utm_campaign','Unspecified')=$${args.length}`); }
  const result = await pool.query(`with attributed as not materialized (
    select e.event_id as id,e.name,e.occurred_at as time,e.visitor_key as visitor,e.session_key as session,e.path,
      coalesce(entry.source,e.source) as source,e.country,e.device,e.environment,
      e.properties || coalesce(entry.utm,'{}'::jsonb) as properties
    from pulse_events e left join lateral (
      select p.source,(select jsonb_object_agg(key,value) from jsonb_each(p.properties) where key like 'utm_%') as utm
      from pulse_events p where p.tenant_id=e.tenant_id and p.site_id=e.site_id and p.environment=e.environment
        and p.session_key=e.session_key and p.name='pageview' and p.occurred_at>=$8 and p.occurred_at<case when e.occurred_at<$7 then $7 else $5 end order by p.occurred_at asc limit 1
    ) entry on true
    where e.tenant_id=$1 and e.site_id=$2 and e.environment=$3
      and ((e.occurred_at>=$4 and e.occurred_at<$5) or (e.occurred_at>=$6 and e.occurred_at<$7))
  ), matched as not materialized (select * from attributed where ${conditions.join(" and ")})
  (select * from matched where time>=$4 and time<$5 order by time desc,id limit 100)
  union
  (select * from matched where time>=$6 and time<$7 order by time desc,id limit 30)
  order by time desc,id`, args);
  return toEvents(result.rows);
}

export async function getEvents(site: AnalyticsSite, range: number, from?: Date) {
  return (await loadEvents(site, from || new Date(Date.now() - Math.min(range * 2 + 2, 182) * 86400000))).events;
}

// Overview and live views refresh every 10 seconds. A short cache keeps that from recomputing
// the whole window each time, while live activity is re-read fresh on every request.
const REPORT_TTL_MS = 20_000;
const reports = new Map<string, { at: number; report: AnalyticsReport }>();

/** A report for a window: sampled when large, cached briefly, with exact live and recent activity. */
export async function buildReport(
  site: AnalyticsSite,
  query: ReportQuery,
  goalNames: string[],
  now = new Date(),
  pool: Pool = analyticsPool(),
  limit = RAW_LIMIT,
) {
  const window = reportWindow(query.range, query.timezone || site.timezone, now, query.from, query.to);
  const key = JSON.stringify([site.id, site.environment, site.identityMode, query, goalNames]);
  const cached = reports.get(key);
  let report: AnalyticsReport;
  if (cached && now.getTime() - cached.at < REPORT_TTL_MS) report = cached.report;
  else {
    const from = new Date(window.previousStart), to = new Date(window.end);
    const { events, sample } = await loadEvents(site, from, to, pool, limit);
    // At most two bounded raw-event samples: one for visitors, one for complete sessions.
    // Exact windows reuse the first result, and cache hits need neither raw-event sample.
    const sessions = sample < 1 ? await loadEvents(site, from, to, pool, limit, "session") : undefined;
    report = summarizeEvents(events, query, now, { identityMode: site.identityMode, goalNames, sample, rawRetentionDays: 90, sessionEvents: sessions?.events, sessionSample: sessions?.sample });
    if (reports.size > 500) reports.clear();
    reports.set(key, { at: now.getTime(), report });
  }
  // Live and recent activity come from an exact query, filtered the same way as the report.
  const latest = await latestEvents(site, now, pool, query, new Date(window.start), new Date(window.end), new Date(window.previousStart));
  return {
    ...report,
    live: latest.filter((e) => Date.parse(e.time) >= now.getTime() - 300_000 && Date.parse(e.time)<now.getTime()).slice(0, 100),
    recent: latest.filter((e) => Date.parse(e.time) >= window.start && Date.parse(e.time) < window.end).slice(0, 30),
    updatedAt: now.toISOString(),
  };
}

export async function getReport(site: AnalyticsSite, query: ReportQuery) {
  const { getReportConfig } = await import("./config");
  const config = await getReportConfig(site.publicId);
  return buildReport(site, query, config.goals);
}
export async function connectionStatus(site: AnalyticsSite) {
  const result = await analyticsPool().query(
    "select max(received_at) as last_event_at from pulse_events where tenant_id=$1 and site_id=$2 and environment=$3",
    [site.tenantId, site.id, site.environment],
  );
  return {
    connected: !!result.rows[0].last_event_at,
    lastEventAt: result.rows[0].last_event_at,
  };
}
