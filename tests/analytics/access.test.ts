import { it, expect } from "vitest";
import { authorizeSite } from "../../src/lib/analytics/access";
it("never grants cross-tenant access and only administrators manage sites", () => {
  expect(() =>
    authorizeSite(
      { tenantId: "a", role: "owner" },
      { tenantId: "b", enabled: true },
      "read",
    ),
  ).toThrow();
  expect(() =>
    authorizeSite(
      { tenantId: "a", role: "viewer" },
      { tenantId: "a", enabled: true },
      "manage",
    ),
  ).toThrow();
  expect(
    authorizeSite(
      { tenantId: "a", role: "member" },
      { tenantId: "a", enabled: true },
      "read",
    ),
  ).toBe(true);
});
it("denies disabled sites even to administrators", () => {
  expect(() =>
    authorizeSite(
      { tenantId: "a", role: "owner" },
      { tenantId: "a", enabled: false },
      "read",
    ),
  ).toThrow();
});
it('lets administrators restore their own disabled app without granting report access',()=>{expect(authorizeSite({tenantId:'a',role:'owner'},{tenantId:'a',enabled:false},'manage')).toBe(true);expect(()=>authorizeSite({tenantId:'a',role:'member'},{tenantId:'a',enabled:false},'manage')).toThrow();expect(()=>authorizeSite({tenantId:'a',role:'owner'},{tenantId:'a',enabled:false},'read')).toThrow()});
