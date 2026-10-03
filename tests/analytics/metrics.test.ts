import { it, expect } from "vitest";
import {
  summarizeEvents,
  evaluateFunnel,
} from "../../src/lib/analytics/metrics";
it("deduplicates event ids and visitors across days and scopes environments", () => {
  const events = [
    {
      id: "1",
      name: "pageview",
      visitor: "v1",
      session: "s1",
      time: "2026-10-01T12:00:00Z",
      path: "/",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "1",
      name: "pageview",
      visitor: "v1",
      session: "s1",
      time: "2026-10-01T12:00:00Z",
      path: "/",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "2",
      name: "pageview",
      visitor: "v1",
      session: "s2",
      time: "2026-10-02T12:00:00Z",
      path: "/pricing",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "3",
      name: "pageview",
      visitor: "v2",
      session: "s3",
      time: "2026-10-02T12:00:00Z",
      path: "/",
      source: "Direct",
      country: "US",
      device: "Desktop",
      environment: "development",
    },
  ] as any;
  const report = summarizeEvents(
    events,
    {
      range: 7,
      source: "",
      metric: "visitors",
      environment: "production",
      compare: true,
    },
    new Date("2026-10-03T12:00:00Z"),
  );
  expect(report.visitors).toBe(1);
  expect(report.pageviews).toBe(2);
  expect(report.sessions).toBe(2);
});
it("funnels require ordered steps in the same session", () => {
  const events = [
    { id: "1", name: "signup", session: "s1", time: "2026-10-01T12:00:00Z" },
    { id: "2", name: "pageview", session: "s1", time: "2026-10-01T12:01:00Z" },
    { id: "3", name: "pageview", session: "s2", time: "2026-10-01T12:00:00Z" },
    { id: "4", name: "signup", session: "s2", time: "2026-10-01T12:01:00Z" },
  ] as any;
  expect(
    evaluateFunnel(events, ["pageview", "signup"], 1800000).map(
      (x) => x.sessions,
    ),
  ).toEqual([2, 1]);
});
