import { it, expect } from "vitest";
import {
  validateBatch,
  sanitizeUrl,
  visitorKey,
} from "../../src/lib/analytics/validation";
const batch = {
  siteId: "app_123",
  environment: "production",
  events: [
    {
      id: "e1",
      name: "pageview",
      timestamp: "2026-10-03T12:00:00Z",
      url: "https://example.com/pricing?password=secret&utm_source=Google#private",
      properties: { plan: "starter" },
    },
  ],
};
it("removes sensitive URL fields and preserves only campaign keys", () => {
  expect(sanitizeUrl(batch.events[0].url)).toEqual({
    path: "/pricing",
    campaign: { utm_source: "Google" },
  });
});
it("rejects invalid payloads and old timestamps", () => {
  expect(() =>
    validateBatch(
      {
        ...batch,
        events: [{ ...batch.events[0], timestamp: "2025-01-01T00:00:00Z" }],
      },
      new Date("2026-10-03T12:01:00Z"),
    ),
  ).toThrow();
  expect(() =>
    validateBatch(
      { ...batch, events: Array(51).fill(batch.events[0]) },
      new Date("2026-10-03T12:01:00Z"),
    ),
  ).toThrow();
});
it("validates real events and derives different keys for each site", () => {
  expect(
    validateBatch(batch, new Date("2026-10-03T12:01:00Z")).events[0].name,
  ).toBe("pageview");
  expect(visitorKey("secret", "site1", "ip", "ua", "2026-10-03")).not.toBe(
    visitorKey("secret", "site2", "ip", "ua", "2026-10-03"),
  );
  expect(visitorKey("secret", "site1", "ip", "ua", "2026-10-03")).not.toContain(
    "ip",
  );
});
it('rejects explicitly sensitive properties and reports invalid timestamp as a client error',()=>{expect(()=>validateBatch({...batch,events:[{...batch.events[0],properties:{password:'private'}}]},new Date('2026-10-03T12:01:00Z'))).toThrow();try{validateBatch({...batch,events:[{...batch.events[0],timestamp:'2025-01-01T00:00:00Z'}]},new Date('2026-10-03T12:01:00Z'))}catch(e){expect((e as any).status).toBe(400)}});
