import { it, expect } from "vitest";
import { getInstallationRecipe } from "../../src/lib/analytics/recipes";
it("browser recipes contain only the public identifier and real hosted script", () => {
  const r = getInstallationRecipe("next", {
    publicSiteId: "site_123",
    endpoint: "https://pulse.axxes.app",
    environment: "production",
  });
  expect(r.code).toContain("site_123");
  expect(r.code).toContain("https://pulse.axxes.app/pulse.v1.js");
  expect(r.code).not.toContain("npm install");
  expect(r.code).not.toContain("SECRET");
});
it("server recipe keeps the secret in server environment configuration", () => {
  const r = getInstallationRecipe("http", {
    publicSiteId: "site_123",
    endpoint: "https://pulse.axxes.app",
    environment: "production",
  });
  expect(r.code).toContain("PULSE_SERVER_KEY");
  expect(r.code).toContain("/api/pulse/server-events");
});
it("rejects injection in generated recipes", () => {
  expect(() =>
    getInstallationRecipe("html", {
      publicSiteId: 'x"><script>',
      endpoint: "https://pulse.axxes.app",
      environment: "production",
    }),
  ).toThrow();
});
