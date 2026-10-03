import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AnalyticsEvent } from "./types";
import type { EventBatch } from "./validation";
import { sanitizeUrl, safeSource, visitorKey } from "./validation";
import type { AnalyticsSite } from "./sites";
import { analyticsPool } from "./postgres";
import { AnalyticsError } from "./access";
import { summarizeEvents } from "./metrics";
import type { ReportQuery } from "./query";
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
) {
  if (batch.environment !== site.environment)
    throw new AnalyticsError("Wrong app environment");
  if (!trusted && site.collection !== "browser")
    throw new AnalyticsError("Use scoped server credentials for this app", 403);
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
  let accepted = 0;
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
    for (const event of batch.events) {
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
      const eventVisitor = event.visitorId
        ? visitorKey(
            secret,
            site.id,
            event.visitorId,
            "persistent",
            "persistent",
          )
        : visitor;
      const session = event.sessionId
        ? visitorKey(secret, site.id, event.sessionId, "session", rotation)
        : visitorKey(
            secret,
            site.id,
            trusted ? event.id : visitor,
            String(Math.floor(Date.parse(event.timestamp) / 1800000)),
            rotation,
          );
      const device = /mobile|android|iphone/i.test(request.userAgent)
        ? "Mobile"
        : request.userAgent
          ? "Desktop"
          : "Unknown";
      const result = await client.query(
        "insert into pulse_events(site_id,tenant_id,environment,event_id,name,occurred_at,visitor_key,session_key,path,source,country,device,properties) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) on conflict(site_id,event_id) do update set properties=excluded.properties,occurred_at=excluded.occurred_at where pulse_events.name='web_vital' and excluded.name='web_vital' and excluded.occurred_at>=pulse_events.occurred_at returning event_id",
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
          JSON.stringify({ ...event.properties, ...sanitized.campaign }),
        ],
      );
      accepted += result.rowCount || 0;
    }
    await client.query("commit");
    return { accepted, duplicates: batch.events.length - accepted };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
export async function getEvents(site: AnalyticsSite, range: number) {
  const result = await analyticsPool().query(
    "select event_id as id,name,occurred_at as time,visitor_key as visitor,session_key as session,path,source,country,device,environment,properties from pulse_events where tenant_id=$1 and site_id=$2 and environment=$3 and occurred_at>=now()-($4::int*interval '1 day') order by occurred_at desc limit 100001",
    [site.tenantId, site.id, site.environment, Math.min(range * 2, 180)],
  );
  if (result.rows.length > 100000)
    throw new AnalyticsError(
      "This report exceeds the current raw-event query limit",
      422,
    );
  return result.rows.map((e) => ({
    ...e,
    time: new Date(e.time).toISOString(),
  })) as AnalyticsEvent[];
}
export async function getReport(site: AnalyticsSite, query: ReportQuery) {
  return summarizeEvents(await getEvents(site, query.range), query);
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
