import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
function fixture(gpc = false, persistent = false, stale = false, endpoint = "", verification = "") {
  const batches: any[] = [];
  const destinations: string[]=[];
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
    __axxesPulseGeneration: 2,
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
          k === "data-verify" ? verification : k === "data-endpoint" ? endpoint : k === "data-native-generation" && stale ? "1" : k === "data-site"
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
        destinations.push(_url);batches.push(body);
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
  return { window, listeners, batches, context, stored, destinations };
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

it("ignores a stale native script after its organization has changed",()=>{expect(fixture(false,false,true).window.pulse).toBeUndefined()});

it("sends to an explicitly configured same-origin proxy",()=>{const f=fixture(false,false,false,"https://example.com/api/analytics");f.window.pulse.flush();expect(f.destinations).toEqual(["https://example.com/api/analytics"])});
it('starts a fresh session after 30 minutes without activity',async()=>{const f=fixture();f.window.pulse.flush();const first=JSON.parse(await f.batches[0].text()).events[0].sessionId;let clock=Date.now()+1800001;class ClockDate extends Date{constructor(value?:string|number){super(value??clock)}static now(){return clock}}f.context.Date=ClockDate;f.window.pulse.track('feature_used');f.window.pulse.flush();const next=JSON.parse(await f.batches[1].text()).events[0].sessionId;expect(next).not.toBe(first)});

it('automatically persists a scoped setup challenge once after consent',async()=>{const f=fixture(false,true,false,'','v_setup');f.window.pulse.flush();expect(f.batches).toHaveLength(0);f.window.pulse.consent(true);f.window.pulse.flush();const events=JSON.parse(await f.batches[0].text()).events;expect(events.filter((e:any)=>e.name==='pulse.verify')).toHaveLength(1);expect(events.find((e:any)=>e.name==='pulse.verify').properties.verification_token).toBe('v_setup');f.window.history.pushState();f.window.pulse.flush();expect(JSON.parse(await f.batches[1].text()).events.some((e:any)=>e.name==='pulse.verify')).toBe(false)});
