import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
function fixture(gpc = false, persistent = false) {
  const batches: any[] = [];
  const listeners: Record<string, Function[]> = {};
  const add = (name: string, fn: Function) => {
    (listeners[name] ||= []).push(fn);
  };
  const location = {
    href: "https://example.com/?password=secret&utm_source=Google",
    pathname: "/",
  };
  const window: any = {
    location,
    history: {
      pushState: () => {
        location.href = "https://example.com/pricing";
      },
      replaceState: () => {},
    },
    addEventListener: add,
    removeEventListener: () => {},
  };
  const stored = new Map<string, string>();
  const context: any = {
    localStorage: {
      getItem: (k: string) => stored.get(k) || null,
      setItem: (k: string, v: string) => stored.set(k, v),
    },
    window,
    location,
    document: {
      currentScript: {
        src: "https://pulse.axxes.app/pulse.v1.js",
        getAttribute: (k: string) =>
          k === "data-site"
            ? "app_123"
            : k === "data-identity" && persistent
              ? "persistent"
              : k === "data-consent" && persistent
                ? "required"
                : null,
      },
      referrer: "https://google.com/search?q=private",
      visibilityState: "visible",
      addEventListener: add,
    },
    navigator: {
      globalPrivacyControl: gpc,
      sendBeacon: (_url: string, body: Blob) => {
        batches.push(body);
        return true;
      },
    },
    crypto: { randomUUID: () => `id_${Math.random()}` },
    URL,
    Blob,
    Date,
    JSON,
    setTimeout: () => 1,
    clearTimeout: () => {},
    fetch: () => Promise.resolve({ ok: true }),
    console,
  };
  runInNewContext(readFileSync("public/pulse.v1.js", "utf8"), context);
  return { window, listeners, batches, context, stored };
}
it("tracks initial page and real SPA navigation once, redacting private URL fields", async () => {
  const f = fixture();
  expect(f.window.pulse).toBeDefined();
  f.window.pulse.flush();
  expect(f.batches).toHaveLength(1);
  const payload = JSON.parse(await f.batches[0].text());
  expect(payload.events).toHaveLength(1);
  expect(payload.events[0].url).toBe("https://example.com/?utm_source=Google");
  f.window.history.pushState();
  f.window.pulse.flush();
  expect(f.batches).toHaveLength(2);
  expect(JSON.parse(await f.batches[1].text()).events[0].url).toBe(
    "https://example.com/pricing",
  );
  runInNewContext(readFileSync("public/pulse.v1.js", "utf8"), f.context);
  f.window.pulse.flush();
  expect(f.batches).toHaveLength(2);
});
it("sends no events when Global Privacy Control is enabled", () => {
  const f = fixture(true);
  expect(f.window.pulse).toBeDefined();
  f.window.pulse.track("signup");
  f.window.pulse.flush();
  expect(f.batches).toHaveLength(0);
});

it("creates a site-scoped persistent key only after explicit consent", async () => {
  const f = fixture(false, true);
  f.window.pulse.flush();
  expect(f.batches).toHaveLength(0);
  expect(f.stored.size).toBe(0);
  f.window.pulse.consent(true);
  f.window.pulse.flush();
  const payload = JSON.parse(await f.batches[0].text());
  expect(payload.events[0].visitorId).toBeDefined();
  expect(f.stored.has("pulse-visitor-app_123")).toBe(true);
});
