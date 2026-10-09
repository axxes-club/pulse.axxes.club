import { expect, it } from "vitest";
import { interactionSummary } from "@/lib/analytics/metrics";
import { isBillable } from "@/lib/billing/entitlement";
import type { AnalyticsEvent } from "@/lib/analytics/types";

let n = 0;
const ev = (name: string, session: string, path: string, properties: AnalyticsEvent["properties"] = {}): AnalyticsEvent => ({
  id: `e${++n}`, name, time: "2026-10-09T12:00:00Z", visitor: "v", session, path, source: "Direct", country: "PR", device: "Desktop", environment: "production", properties,
});

it("summarizes contact, outbound, downloads, forms, scroll reach and engaged time", () => {
  const events = [
    ev("contact_click", "s1", "/", { method: "whatsapp" }),
    ev("contact_click", "s2", "/", { method: "email" }),
    ev("contact_click", "s3", "/", { method: "whatsapp" }),
    ev("outbound_click", "s1", "/", { host: "instagram.com" }),
    ev("file_download", "s1", "/", { file: "catalogo.pdf" }),
    ev("form_submit", "s2", "/contacto/", { form: "wpforms-form-12", kind: "form" }),
    ev("scroll_depth", "s1", "/", { depth: 25 }), ev("scroll_depth", "s1", "/", { depth: 50 }),
    ev("scroll_depth", "s2", "/", { depth: 25 }),
    ev("engagement", "s1", "/", { seconds: 30 }), ev("engagement", "s1", "/", { seconds: 30 }),
    ev("engagement", "s2", "/", { seconds: 120 }),
  ];
  const summary = interactionSummary(events, 4);
  expect(summary.contact).toEqual([{ name: "whatsapp", value: 2 }, { name: "email", value: 1 }]);
  expect(summary.outbound).toEqual([{ name: "instagram.com", value: 1 }]);
  expect(summary.downloads).toEqual([{ name: "catalogo.pdf", value: 1 }]);
  expect(summary.forms).toEqual([{ name: "wpforms-form-12", value: 1 }]);
  expect(summary.scroll).toEqual([{ name: "25%", value: 50 }, { name: "50%", value: 25 }, { name: "75%", value: 0 }, { name: "100%", value: 0 }]);
  // Two page visits: 60s (two visible stretches) and 120s.
  expect(summary.engagement).toEqual({ averageSeconds: 90, pages: 2 });
});

it("returns empty lists when no automatic interactions were recorded", () => {
  const summary = interactionSummary([ev("pageview", "s1", "/")], 1);
  expect(summary.scroll).toEqual([]);
  expect(summary.engagement).toEqual({ averageSeconds: null, pages: 0 });
});

it("charges clicks and submissions, not passive measurements", () => {
  for (const name of ["contact_click", "outbound_click", "file_download", "form_submit"]) expect(isBillable(name)).toBe(true);
  for (const name of ["scroll_depth", "engagement", "web_vital"]) expect(isBillable(name)).toBe(false);
});
