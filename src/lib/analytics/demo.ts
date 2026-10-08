import type { AnalyticsEvent } from "./types";
export function demoEvents(now = new Date()): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  const sources = [
    "Direct",
    "Google",
    "Instagram",
    "AXXES",
    "LinkedIn",
    "Bing",
  ];
  const countries = [
    "United States",
    "Puerto Rico",
    "United Kingdom",
    "Spain",
    "Germany",
  ];
  const paths = [
    "/",
    "/pricing",
    "/features",
    "/docs",
    "/blog/introducing-pulse",
  ];
  for (let day = 0; day < 180; day++) {
    const amount =
      150 + Math.floor(80 * Math.sin(day * 0.7)) + ((day * 31) % 140);
    for (let i = 0; i < amount; i++) {
      const time = new Date(
        now.getTime() - (day * 86400000 + i * 211000 + 1000),
      ).toISOString();
      const session = `s-${day}-${i}`;
      const base = {
        time,
        visitor: `v-${(day * 43 + i) % 6500}`,
        session,
        properties: { __pulse_identity: "persistent" },
        path: paths[i % 5],
        source: sources[(i + day) % 6],
        country: countries[(i * 3 + day) % 5],
        device: i % 3 === 0 ? "Mobile" : "Desktop",
        environment: (i % 29 === 0 ? "development" : "production") as
          "development" | "production",
      };
      events.push({ ...base, id: `e-${day}-${i}`, name: "pageview" });
      if (i % 19 === 0) {
        for (const [metric, value] of [
          ["LCP", 1100 + ((i * 13) % 1100)],
          ["INP", 80 + ((i * 7) % 120)],
          ["CLS", 0.01 + (i % 12) * 0.006],
        ] as const)
          events.push({
            ...base,
            id: `vital-${metric}-${day}-${i}`,
            name: "web_vital",
            properties: { metric, value },
          });
      }
      if (i % 17 === 0)
        events.push({
          ...base,
          id: `c-${day}-${i}`,
          name: "signup",
          time: new Date(Date.parse(time) + 100).toISOString(),
        });
    }
  }
  return events;
}
