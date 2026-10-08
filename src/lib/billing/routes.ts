import "server-only";
import { getContext } from "@/lib/context";
import { AnalyticsError } from "@/lib/analytics/access";
import { requireSameOrigin } from "@/lib/analytics/http";

/** Billing changes need a same-origin request from an owner or admin of the active organization. */
export async function requireBillingAdmin(request: Request) {
  requireSameOrigin(request);
  const ctx = await getContext();
  if (!ctx) throw new AnalyticsError("Sign in with AXXES", 401);
  if (!["owner", "admin"].includes(ctx.role))
    throw new AnalyticsError("Only an organization owner or admin can manage billing", 403);
  return ctx;
}

const ORIGINS = ["https://pulse.axxes.app", "https://pulse.axxes.club"];

/**
 * Where Payments sends the buyer back. Only Pulse's own registered origins are ever offered, so a
 * forged Host header cannot point a return link anywhere else (Payments checks it again).
 */
export function pulseOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const candidate = `https://${host}`;
  return ORIGINS.includes(candidate) ? candidate : ORIGINS[0];
}
