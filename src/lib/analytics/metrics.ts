import type { ReportQuery } from "./query";
import type { AnalyticsEvent, AnalyticsReport, Breakdown } from "./types";
import { performanceSummary, retentionCohorts } from "./advanced";
const DAY = 86400000;
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
export function summarizeEvents(
  input: AnalyticsEvent[],
  query: ReportQuery,
  now = new Date(),
  options: {
    identityMode?: "ephemeral" | "persistent";
    goalNames?: string[];
  } = {},
): AnalyticsReport {
  const unique = [...new Map(input.map((e) => [e.id, e])).values()].filter(
    (e) =>
      e.environment === query.environment &&
      (!query.source || e.source === query.source) &&
      e.name !== "pulse.verify",
  );
  const end = now.getTime(),
    start = end - query.range * DAY;
  const select = (from: number, to: number) =>
    unique.filter((e) => {
      const t = new Date(e.time).getTime();
      return t >= from && t < to;
    });
  const events = select(start, end),
    previous = select(start - query.range * DAY, start);
  const metric = (es: AnalyticsEvent[]) => ({
    visitors: new Set(
      es.filter((e) => e.name === "pageview").map((e) => e.visitor),
    ).size,
    pageviews: es.filter((e) => e.name === "pageview").length,
    sessions: new Set(es.map((e) => e.session)).size,
    conversions: new Set(
      es
        .filter((e) =>
          (
            options.goalNames || ["signup", "purchase", "trial_started"]
          ).includes(e.name),
        )
        .map((e) => e.session),
    ).size,
  });
  const counts = metric(events),
    prev = metric(previous);
  const series = (offset: number) =>
    Array.from({ length: query.range }, (_, i) => {
      const from = start + (i - offset) * DAY;
      return {
        time: new Date(from).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        value: metric(select(from, from + DAY))[query.metric],
      };
    });
  const pages = events.filter((e) => e.name === "pageview");
  return {
    identityMode: options.identityMode || "ephemeral",
    performance: performanceSummary(events),
    cohorts: retentionCohorts(events, options.identityMode || "ephemeral"),
    ...counts,
    conversionRate: counts.sessions
      ? (counts.conversions / counts.sessions) * 100
      : 0,
    series: series(0),
    comparison: series(query.range),
    sources: breakdown(pages, "source"),
    pages: breakdown(pages, "path"),
    countries: breakdown(pages, "country"),
    devices: breakdown(pages, "device"),
    events: breakdown(
      events.filter((e) => e.name !== "pageview" && e.name !== "web_vital"),
      "name",
    ),
    recent: events
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
      .slice(0, 30),
    updatedAt: now.toISOString(),
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
