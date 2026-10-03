import { describe, it, expect } from "vitest";
import { parseReportQuery, queryString } from "../../src/lib/analytics/query";
describe("report query", () => {
  it("keeps filters and development environment across refresh", () => {
    const q = parseReportQuery(
      new URLSearchParams("range=30&source=Google&environment=development"),
      new Date("2026-10-03T12:00:00Z"),
    );
    expect(q.range).toBe(30);
    expect(q.source).toBe("Google");
    expect(q.environment).toBe("development");
    expect(
      parseReportQuery(
        new URLSearchParams(queryString(q)),
        new Date("2026-10-03T12:00:00Z"),
      ),
    ).toEqual(q);
  });
  it("falls back safely for unsupported date range and environment", () => {
    const q = parseReportQuery(
      new URLSearchParams("range=-1&environment=other&metric=secret"),
      new Date("2026-10-03T12:00:00Z"),
    );
    expect(q.range).toBe(7);
    expect(q.environment).toBe("production");
    expect(q.metric).toBe("visitors");
  });
});
it('supports bounded custom complete-day ranges and rejects invalid dates',()=>{const q=parseReportQuery(new URLSearchParams('from=2026-09-10&to=2026-09-12&timezone=America/New_York'),new Date('2026-10-03T12:00:00Z'));expect(q.range).toBe(3);expect(q.from).toBe('2026-09-10');expect(q.to).toBe('2026-09-12');expect(parseReportQuery(new URLSearchParams('from=2026-02-30&to=2026-03-04'),new Date('2026-10-03T12:00:00Z')).from).toBe('')});
