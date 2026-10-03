import { it, expect } from "vitest";
import { readJson, requireSameOrigin } from "../../src/lib/analytics/http";
it("bounds streamed payloads, including requests without content-length", async () => {
  const request = new Request("https://pulse.axxes.app/api/pulse/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(33000) }),
  });
  await expect(readJson(request)).rejects.toMatchObject({ status: 413 });
});
it("rejects cross-site administration while allowing the primary Pulse origin", () => {
  expect(() =>
    requireSameOrigin(
      new Request("https://pulse.axxes.app/api/pulse/sites", {
        headers: { Origin: "https://evil.example" },
      }),
    ),
  ).toThrow();
  expect(() =>
    requireSameOrigin(
      new Request("https://pulse.axxes.app/api/pulse/sites", {
        headers: { Origin: "https://pulse.axxes.app" },
      }),
    ),
  ).not.toThrow();
});
