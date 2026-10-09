import {clientIp} from "@/lib/security/admission";
import { readJson, errorResponse } from "@/lib/analytics/http";
import { validateBatch } from "@/lib/analytics/validation";
import { findPublicSite } from "@/lib/analytics/sites";
import { persistBatch } from "@/lib/analytics/storage";
import { AnalyticsError } from "@/lib/analytics/access";
import { allowance } from "@/lib/billing/store";
export async function POST(request: Request) {
  let allowedOrigin: string | null = null;
  let siteId = "", eventOrigin = "";
  try {
    const batch = validateBatch(await readJson(request));
    siteId = batch.siteId;
    try { eventOrigin = new URL(batch.events.find((e) => e.url)?.url || "").origin; } catch {}
    const site = await findPublicSite(batch.siteId);
    if (!site) throw new AnalyticsError("Unknown or disabled app", 404);
    const origin = request.headers.get("origin");
    if (!origin || !site.allowedOrigins.includes(origin))
      throw new AnalyticsError("Origin is not allowed for this app", 403);
    allowedOrigin = origin;
    for (const event of batch.events) {
      if (
        !event.url ||
        !site.allowedOrigins.includes(new URL(event.url).origin)
      )
        throw new AnalyticsError("Event URL does not belong to this app", 403);
    }
    const result = await persistBatch(site, batch, {
      ip:
        clientIp(request.headers),
      country: /^[A-Z]{2}$/.test(request.headers.get("x-pulse-country") || "") ? new Intl.DisplayNames(["en"],{type:"region"}).of(request.headers.get("x-pulse-country")!) || "Unknown" : "Unknown",
      userAgent: request.headers.get("user-agent") || "",
    }, false, undefined, await allowance(site.tenantId));
    return Response.json(result, {
      status: 202,
      headers: {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const response = errorResponse(e);
    // Refusals are otherwise invisible to the site owner; record which check failed and against what.
    if (response.status === 403 || response.status === 404)
      console.warn("pulse_collect_refused", JSON.stringify({ status: response.status, reason: e instanceof Error ? e.message : "unknown", site: siteId, origin: request.headers.get("origin") || "", eventOrigin }));
    if (allowedOrigin)
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Vary", "Origin");
    return response;
  }
}
