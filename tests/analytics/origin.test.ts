import { describe, expect, it, vi } from "vitest";
import { OriginError, logOriginRejection, parseAppOrigin } from "@/lib/analytics/origin";

function reason(input: string, env: "production" | "development" = "production") {
  try {
    parseAppOrigin(input, env);
    return "ok";
  } catch (e) {
    return e instanceof OriginError ? e.reason : "other";
  }
}

describe("parseAppOrigin", () => {
  it("accepts https addresses and reduces them to the origin", () => {
    expect(parseAppOrigin("https://www.example.com/path?q=1", "production")).toBe("https://www.example.com");
    expect(parseAppOrigin("  https://example.com/  ", "production")).toBe("https://example.com");
    expect(parseAppOrigin("\u200bhttps://example.com\u00a0", "production")).toBe("https://example.com");
  });
  it("assumes https when the scheme is missing", () => {
    expect(parseAppOrigin("example.com", "production")).toBe("https://example.com");
    expect(parseAppOrigin("www.example.com/about", "production")).toBe("https://www.example.com");
    expect(parseAppOrigin("example.com:443", "production")).toBe("https://example.com");
    expect(parseAppOrigin("example.com:8443", "production")).toBe("https://example.com:8443");
    expect(parseAppOrigin("//example.com", "production")).toBe("https://example.com");
  });
  it("uses http for bare localhost in development", () => {
    expect(parseAppOrigin("localhost:3000", "development")).toBe("http://localhost:3000");
    expect(parseAppOrigin("http://localhost:3000", "development")).toBe("http://localhost:3000");
  });
  it("names the specific problem and echoes the input", () => {
    expect(reason("")).toBe("empty");
    expect(reason("   ")).toBe("empty");
    expect(reason("http://example.com")).toBe("insecure_in_production");
    expect(reason("ftp://example.com")).toBe("unsupported_scheme");
    expect(reason("https://user:pw@example.com")).toBe("credentials");
    expect(reason("https://exa mple.com")).toBe("unparseable");
    expect(() => parseAppOrigin("http://example.com", "production")).toThrow(/"http:\/\/example.com" uses http.*https:\/\/example.com/);
    expect(() => parseAppOrigin("ftp://x.com", "production")).toThrow(/uses ftp/);
  });
  it("shows invisible characters instead of hiding them", () => {
    expect(() => parseAppOrigin("http://example.com\u200b", "production")).toThrow(/\\u200b/);
  });
  it("logs the reason and parsed host without the raw value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      parseAppOrigin("http://user:secret@example.com/p", "production");
    } catch (e) {
      logOriginRejection(e as OriginError, { action: "create" });
    }
    const line = warn.mock.calls[0].join(" ");
    expect(line).toContain("pulse_origin_rejected");
    expect(line).toContain('"reason":"credentials"');
    expect(line).toContain('"host":"example.com"');
    expect(line).not.toContain("secret");
    warn.mockRestore();
  });
});
