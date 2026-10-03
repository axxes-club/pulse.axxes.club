import { dateInZone } from "./timezone";
import type { AnalyticsEvent } from "./types";
export function performanceSummary(
  events: AnalyticsEvent[],
): Record<"LCP" | "INP" | "CLS", { p75: number | null; samples: number }> {
  const result = {} as Record<
    "LCP" | "INP" | "CLS",
    { p75: number | null; samples: number }
  >;
  for (const metric of ["LCP", "INP", "CLS"] as const) {
    const values = events
      .filter(
        (e) =>
          e.name === "web_vital" &&
          e.properties?.metric === metric &&
          typeof e.properties?.value === "number" &&
          Number.isFinite(e.properties.value) &&
          e.properties.value >= 0,
      )
      .map((e) => Number(e.properties!.value))
      .sort((a, b) => a - b);
    result[metric] = {
      p75: values.length ? values[Math.ceil(values.length * 0.75) - 1] : null,
      samples: values.length,
    };
  }
  return result;
}
export function retentionCohorts(
  events: AnalyticsEvent[],
  mode: "ephemeral" | "persistent",
  now = new Date(),
  observationEnd = now,
  timezone = "UTC",
): Array<{ day: string; size: number; retained: Array<number|null> }> {
  if (mode !== "persistent") return [];
  const visits = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.name !== "pageview") continue;
    const days = visits.get(e.visitor) || new Set<string>();
    days.add(dateInZone(Date.parse(e.time),timezone));
    visits.set(e.visitor, days);
  }
  const cohorts = new Map<
    string,
    { day: string; size: number; retained: Array<number|null> }
  >();
  for (const days of visits.values()) {
    const first = [...days].sort()[0];
    const c = cohorts.get(first) || {
      day: first,
      size: 0,
      retained: [0, 0, 0, 0, 0, 0, 0],
    };
    c.size++;
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(Date.parse(first + "T00:00:00Z") + offset * 86400000)
        .toISOString()
        .slice(0, 10);
      if (days.has(day)) c.retained[offset]=(c.retained[offset] || 0)+1;
    }
    const completeThrough=dateInZone(Math.min(now.getTime(),observationEnd.getTime()),timezone);
    for(let i=0;i<7;i++){const day=new Date(Date.parse(first+"T00:00:00Z")+i*86400000).toISOString().slice(0,10);if(day>=completeThrough)c.retained[i]=null;}
    cohorts.set(first, c);
  }
  return [...cohorts.values()].sort((a, b) => a.day.localeCompare(b.day));
}
