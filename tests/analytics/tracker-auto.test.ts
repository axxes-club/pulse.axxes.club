import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function fixture(auto: string | null, page = { scrollHeight: 4000, innerHeight: 1000 }) {
  const batches: Blob[] = [];
  let ids = 0, now = 1_000_000;
  const windowListeners: Record<string, Function[]> = {};
  const documentListeners: Record<string, Function[]> = {};
  const timers: Function[] = [];
  const location = { href: "https://example.com/art/piece", host: "example.com", pathname: "/art/piece" };
  const window: any = {
    location,
    scrollY: 0,
    innerHeight: page.innerHeight,
    history: { pushState: () => { location.href = "https://example.com/contacto"; location.pathname = "/contacto"; }, replaceState: () => {} },
    addEventListener: (n: string, fn: Function) => (windowListeners[n] ||= []).push(fn),
    removeEventListener: () => {},
  };
  const document: any = {
    currentScript: {
      src: "https://pulse.axxes.app/pulse.v1.js",
      getAttribute: (k: string) => (k === "data-site" ? "app_123" : k === "data-auto" ? auto : null),
    },
    referrer: "",
    visibilityState: "visible",
    documentElement: { scrollHeight: page.scrollHeight, clientHeight: page.innerHeight, scrollTop: 0 },
    body: { scrollHeight: page.scrollHeight },
    addEventListener: (n: string, fn: Function) => (documentListeners[n] ||= []).push(fn),
    removeEventListener: () => {},
  };
  const context: any = {
    window, document, location,
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { globalPrivacyControl: false, sendBeacon: (_u: string, body: Blob) => { batches.push(body); return true; } },
    crypto: { randomUUID: () => `id_${++ids}` },
    URL, Blob, JSON, console,
    setTimeout: (fn: Function) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    fetch: () => Promise.resolve({ ok: true }),
  };
  context.Date = class extends Date { static now() { return now; } };
  runInNewContext(readFileSync("public/pulse.v1.js", "utf8"), context);
  const link = (href: string, attrs: Record<string, string> = {}) => {
    const el: any = {
      href: new URL(href, location.href).href,
      getAttribute: (k: string) => (k === "href" ? href : attrs[k] ?? null),
      hasAttribute: (k: string) => k in attrs,
    };
    el.closest = () => el;
    return el;
  };
  const form = (attrs: Record<string, string>, search = false) => ({
    tagName: "FORM",
    getAttribute: (k: string) => attrs[k] ?? null,
    querySelector: () => (search ? {} : null),
  });
  return {
    window, document,
    click: (el: any) => documentListeners.click?.forEach((fn) => fn({ target: el })),
    submit: (f: any) => documentListeners.submit?.forEach((fn) => fn({ target: f })),
    scrollTo: (y: number) => { window.scrollY = y; windowListeners.scroll?.forEach((fn) => fn()); },
    runTimers: () => { while (timers.length) timers.shift()!(); },
    advance: (ms: number) => { now += ms; },
    hide: () => { document.visibilityState = "hidden"; documentListeners.visibilitychange?.forEach((fn) => fn()); },
    link, form,
    events: async () => {
      window.pulse.flush();
      const all = [];
      for (const b of batches) all.push(...JSON.parse(await b.text()).events);
      return all as Array<{ name: string; url: string; properties: Record<string, unknown> }>;
    },
  };
}

it("records nothing extra unless data-auto is set", async () => {
  const f = fixture(null);
  f.click(f.link("mailto:otto@example.com"));
  f.click(f.link("https://instagram.com/x"));
  f.submit(f.form({ id: "contact" }));
  f.scrollTo(3000); f.runTimers();
  expect((await f.events()).map((e) => e.name)).toEqual(["pageview"]);
});

it("records contact methods without the address or number", async () => {
  const f = fixture("all");
  f.click(f.link("mailto:otto@example.com?subject=Hi"));
  f.click(f.link("tel:+17875551234"));
  f.click(f.link("https://wa.me/17875551234"));
  const contacts = (await f.events()).filter((e) => e.name === "contact_click");
  expect(contacts.map((e) => e.properties.method)).toEqual(["email", "phone", "whatsapp"]);
  expect(JSON.stringify(contacts)).not.toMatch(/otto@|5551234/);
});

it("records outbound hosts and downloads, but not same-site links", async () => {
  const f = fixture("outbound,downloads");
  f.click(f.link("https://www.instagram.com/coleccion/?igsh=abc"));
  f.click(f.link("/catalogo/Obras%202024.pdf"));
  f.click(f.link("/artistas/"));
  f.click(f.link("mailto:x@example.com"));
  const events = (await f.events()).filter((e) => e.name !== "pageview");
  expect(events).toEqual([
    expect.objectContaining({ name: "outbound_click", properties: { host: "instagram.com" } }),
    expect.objectContaining({ name: "file_download", properties: { file: "Obras 2024.pdf", type: "pdf", host: "" } }),
  ]);
});

it("records form submissions by id and kind, never their fields", async () => {
  const f = fixture("forms");
  f.submit(f.form({ id: "wpforms-form-12" }));
  f.submit(f.form({}, true));
  const forms = (await f.events()).filter((e) => e.name === "form_submit");
  expect(forms.map((e) => e.properties)).toEqual([{ form: "wpforms-form-12", kind: "form" }, { form: "form", kind: "search" }]);
});

it("records each scroll depth once per page", async () => {
  const f = fixture("scroll");
  f.runTimers();
  f.scrollTo(1600); f.runTimers();
  f.scrollTo(1700); f.runTimers();
  f.scrollTo(3000); f.runTimers();
  const depths = (await f.events()).filter((e) => e.name === "scroll_depth").map((e) => e.properties.depth);
  expect(depths).toEqual([25, 50, 75, 100]);
});

it("reports visible time for the page it was measured on", async () => {
  const f = fixture("engagement");
  f.advance(42_000);
  f.window.history.pushState();
  f.advance(5_000);
  f.hide();
  const engaged = (await f.events()).filter((e) => e.name === "engagement");
  expect(engaged.map((e) => [e.url, e.properties.seconds])).toEqual([
    ["https://example.com/art/piece", 42],
    ["https://example.com/contacto", 5],
  ]);
});
