import type { ReportQuery } from "./query";
import type { AnalyticsEvent, AnalyticsReport, Breakdown } from "./types";
import { attributeSessions } from "./attribution";
import { performanceSummary, retentionCohorts } from "./advanced";
import { reportWindow } from "./timezone";
function breakdown(
  events: AnalyticsEvent[],
  key: "source" | "path" | "country" | "device" | "name",
): Breakdown[] {
  const result = new Map<string, number>();
  for (const e of events) {
    const k = e[key] || "Unknown";
    result.set(k, (result.get(k) || 0) + 1);
  }
  return [...result]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
export function filteredEvents(input:AnalyticsEvent[],query:ReportQuery){
  return attributeSessions([...new Map(input.map((e) => [e.id, e])).values()]).filter(
    (e) =>
      e.environment === query.environment &&
      (!query.source || e.source === query.source) &&
      (!query.path || e.path === query.path) &&
      (!query.country || e.country === query.country) &&
      (!query.device || e.device === query.device) &&
      (!query.campaign || (e.properties?.utm_campaign || "Unspecified") === query.campaign) &&
      e.name !== "pulse.verify",
  );
}
export function summarizeEvents(
  input: AnalyticsEvent[],
  query: ReportQuery,
  now = new Date(),
  options: {
    identityMode?: "ephemeral" | "persistent";
    goalNames?: string[];
    /** Fraction of visitors present in `input` when it is a sample; counts are scaled up by its inverse. */
    sample?: number | null;
    /** Complete sessions use a separate sample because daily visitor keys can rotate mid-session. */
    sessionEvents?: AnalyticsEvent[];
    sessionSample?: number | null;
    /** Real reports cannot compare periods whose raw history has expired. Demo inputs omit this. */
    rawRetentionDays?: number;
  } = {},
): AnalyticsReport {
  const factor = options.sample && options.sample < 1 ? 1 / options.sample : 1;
  const up = (n: number) => (factor === 1 ? n : Math.round(n * factor));
  const upAll = (list: Breakdown[]) => (factor === 1 ? list : list.map((b) => ({ ...b, value: up(b.value) })));
  const unique = filteredEvents(input,query);
  const sessionUnique = options.sessionEvents ? filteredEvents(options.sessionEvents, query) : unique;
  const sessionShare = options.sessionSample ?? options.sample;
  const sessionFactor = sessionShare && sessionShare < 1 ? 1 / sessionShare : 1;
  const upSession = (n: number) => sessionFactor === 1 ? n : Math.round(n * sessionFactor);
  const window = reportWindow(query.range, query.timezone || "UTC", now,query.from,query.to);
  const {start,end} = window;
  const retainedFrom = options.rawRetentionDays === undefined
    ? -Infinity
    : now.getTime() - options.rawRetentionDays * 86400000;
  const comparisonAvailable = window.previousStart >= retainedFrom;
  const historyAvailable = start >= retainedFrom;
  const selectFrom = (es: AnalyticsEvent[], from: number, to: number) =>
    es.filter((e) => {
      const t = new Date(e.time).getTime();
      return t >= from && t < to;
    });
  const select = (from: number, to: number) => selectFrom(unique, from, to);
  const selectSessions = (from: number, to: number) => selectFrom(sessionUnique, from, to);
  const events = select(start, end),
    previous = select(window.previousStart, start);
  const metric = (es: AnalyticsEvent[]) => { const pageSessions = new Set(es.filter(e=>e.name === "pageview" || (e.properties?.pulse_collection === "browser" && e.name !== "web_vital")).map(e=>e.session)); return ({
    visitors: new Set(
      es.filter((e) => e.name === "pageview").map((e) => e.visitor),
    ).size,
    pageviews: es.filter((e) => e.name === "pageview").length,
    sessions: pageSessions.size,
    conversions: new Set(
      es
        .filter((e) =>
          (
            options.goalNames || ["signup", "purchase", "trial_started"]
          ).includes(e.name) && pageSessions.has(e.session),
        )
        .map((e) => e.session),
    ).size,
  }); };
  const scaled = (m: ReturnType<typeof metric>, sessions: ReturnType<typeof metric>) => ({
    visitors: up(m.visitors),
    pageviews: up(m.pageviews),
    sessions: upSession(sessions.sessions),
    conversions: upSession(sessions.conversions),
  });
  const currentSessions = metric(selectSessions(start, end));
  const counts = scaled(metric(events), currentSessions),
    prev = scaled(metric(previous), metric(selectSessions(window.previousStart, start)));
  const series = (offset: number) =>
    Array.from({ length: query.range }, (_, i) => {
      const buckets = offset ? window.previousBuckets : window.buckets;
      const from = buckets[i];
      return {
        time: new Date(from).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: window.timezone,
        }),
        value: query.metric === "conversions"
          ? upSession(metric(selectSessions(from, buckets[i+1])).conversions)
          : up(metric(select(from, buckets[i+1]))[query.metric]),
      };
    });
  const pages = events.filter((e) => e.name === "pageview");
  return {
    identityMode: options.identityMode || "ephemeral",
    performance: performanceSummary(events),
    cohorts: retentionCohorts(events, options.identityMode || "ephemeral",now,new Date(end),window.timezone).map((c) =>
      factor === 1 ? c : { ...c, size: up(c.size), retained: c.retained.map((r) => (r === null ? null : up(r))) },
    ),
    ...counts,
    conversionRate: currentSessions.sessions
      ? (currentSessions.conversions / currentSessions.sessions) * 100
      : 0,
    series: series(0),
    comparison: comparisonAvailable ? series(query.range) : [],
    comparisonAvailable,
    historyAvailable,
    sources: upAll(breakdown(pages, "source")),
    campaigns:upAll(breakdown(pages.map(e=>({...e,name:String(e.properties?.utm_campaign || "Unspecified")})),"name")),
    pages: upAll(breakdown(pages, "path")),
    countries: upAll(breakdown(pages, "country")),
    devices: upAll(breakdown(pages, "device")),
    events: upAll(breakdown(
      events.filter((e) => e.name !== "pageview" && e.name !== "web_vital"),
      "name",
    )),
    live: select(now.getTime()-300000,now.getTime()).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,100),
    recent: events
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
      .slice(0, 30),
    updatedAt: now.toISOString(),
    sample: factor === 1 ? null : options.sample,
    sessionSample: sessionFactor === 1 ? null : sessionShare,
    previous: prev,
  };
}
export function evaluateFunnel(
  events: AnalyticsEvent[],
  steps: string[],
  windowMs: number,
): Array<{ step: string; sessions: number; rate: number }> {
  const bySession = new Map<string, AnalyticsEvent[]>();
  for (const e of [...new Map(events.map((e) => [e.id, e])).values()]) {
    const list = bySession.get(e.session) || [];
    list.push(e);
    bySession.set(e.session, list);
  }
  const counts = steps.map(() => 0);
  for (const list of bySession.values()) {
    list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    let best = 0;
    for (let start = 0; start < list.length; start++) {
      if (list[start].name !== steps[0]) continue;
      let next = 1;
      for (let i = start + 1; i < list.length && next < steps.length; i++) {
        if (Date.parse(list[i].time) - Date.parse(list[start].time) > windowMs)
          break;
        if (list[i].name === steps[next]) next++;
      }
      best = Math.max(best, next);
    }
    for (let i = 0; i < best; i++) counts[i]++;
  }
  return steps.map((step, i) => ({
    step,
    sessions: counts[i],
    rate: counts[0] ? (counts[i] / counts[0]) * 100 : 0,
  }));
}
