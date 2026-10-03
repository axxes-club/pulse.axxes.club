import { it, expect } from "vitest";
import {
  performanceSummary,
  retentionCohorts,
} from "../../src/lib/analytics/advanced";
it("reports measured p75 with explicit sample size and unknown metrics excluded", () => {
  const events = [100, 200, 300, 400].map((value, i) => ({
    id: String(i),
    name: "web_vital",
    properties: { metric: "LCP", value },
  })) as any;
  expect(performanceSummary(events).LCP).toEqual({ p75: 300, samples: 4 });
  expect(performanceSummary([]).INP).toEqual({ p75: null, samples: 0 });
});
it("counts a cohort visitor returning the next day once", () => {
  const events = [
    { name: "pageview", visitor: "v1", time: "2026-10-01T12:00:00Z" },
    { name: "pageview", visitor: "v1", time: "2026-10-02T12:00:00Z" },
    { name: "pageview", visitor: "v1", time: "2026-10-02T13:00:00Z" },
    { name: "pageview", visitor: "v2", time: "2026-10-01T12:00:00Z" },
  ] as any;
  expect(retentionCohorts(events, "persistent")).toEqual([
    { day: "2026-10-01", size: 2, retained: [2, 1, 0, 0, 0, 0, 0] },
  ]);
  expect(retentionCohorts(events, "ephemeral")).toEqual([]);
});
