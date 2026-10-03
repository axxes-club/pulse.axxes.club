import { describe, expect, it } from "vitest";
import { matchVerification } from "@/lib/analytics/verification";
describe("installation verification", () => {
  it("requires an unexpired token, matching environment and persisted event after issue", () => {
    const challenge = {
      token: "v_test",
      environment: "production",
      issuedAt: "2026-10-03T10:00:00Z",
      expiresAt: "2026-10-03T10:10:00Z",
    };
    const event = {
      token: "v_test",
      environment: "production",
      receivedAt: "2026-10-03T10:01:00Z",
    };
    const now = new Date("2026-10-03T10:02:00Z");
    expect(matchVerification(challenge, event, now)).toBe(true);
    expect(
      matchVerification(
        challenge,
        { ...event, environment: "development" },
        now,
      ),
    ).toBe(false);
    expect(
      matchVerification(challenge, { ...event, token: "other" }, now),
    ).toBe(false);
    expect(
      matchVerification(challenge, event, new Date("2026-10-03T10:11:00Z")),
    ).toBe(false);
    expect(
      matchVerification(
        challenge,
        { ...event, receivedAt: "2026-10-03T09:59:00Z" },
        now,
      ),
    ).toBe(false);
  });
});
